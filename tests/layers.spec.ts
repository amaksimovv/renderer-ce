import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BookingClient } from '../src/BookingClient';
import type { SeatmapRenderer } from '../src/SeatmapRenderer';
import type { SeatmapData } from '../src/types';
import type * as RendererCE from './internal-fixture';
import { fixturePath } from './global-setup';

declare global {
  interface Window {
    SeatmapCE: typeof RendererCE;
    layerClient: BookingClient;
    layerRenderer: SeatmapRenderer;
    outlineClicks: string[];
    svgExecuted?: boolean;
  }
}

const bounds = { x: 0, y: 0, width: 100, height: 100 };
const background = {
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 100 100"><rect x="10" y="20" width="50" height="100" fill="#e15b64"/><rect x="60" y="20" width="50" height="100" fill="#3879b4"/></svg>',
  bounds,
};

async function mount(page: Page, data: SeatmapData): Promise<void> {
  await page.goto('/');
  await page.addScriptTag({ path: fixturePath });
  await page.evaluate((data) => {
    const host = document.createElement('div');
    host.id = 'layer-fixture';
    host.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;z-index:10;';
    document.body.append(host);
    window.layerClient = new window.SeatmapCE.BookingClient({ data });
    window.outlineClicks = [];
    window.layerRenderer = new window.SeatmapCE.SeatmapRenderer(host, {
      client: window.layerClient,
      onOutlineClick: (outline) => {
        window.outlineClicks.push(outline.id);
      },
    });
  }, data);
}

const position = (x: number, y: number, zoom = 1) => ({
  x: 160 + (x - 50) * 2.688 * zoom,
  y: 160 + (y - 50) * 2.688 * zoom,
});

async function pixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.locator('#layer-fixture canvas[data-seatmap-layer=map]').evaluate(
    (element, point) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing 2D context');
      const ratio = canvas.width / canvas.clientWidth;
      return [
        ...context.getImageData(Math.round(point.x * ratio), Math.round(point.y * ratio), 1, 1)
          .data,
      ].slice(0, 3);
    },
    position(x, y),
  );
}

test('draws an SVG viewBox at its world bounds and keeps it aligned through zoom', async ({
  page,
}) => {
  await mount(page, { seats: [], background });
  await expect(page.locator('#layer-fixture [role="listbox"]')).toHaveAttribute(
    'data-background-status',
    'ready',
  );
  await expect.poll(() => pixel(page, 25, 50)).toEqual([225, 91, 100]);
  await expect.poll(() => pixel(page, 75, 50)).toEqual([56, 121, 180]);
  await page.evaluate(() => {
    window.layerRenderer.zoomIn();
  });
  await expect.poll(() => pixel(page, 25, 50)).toEqual([225, 91, 100]);
  await expect.poll(() => pixel(page, 75, 50)).toEqual([56, 121, 180]);
});

test('renders outline holes, gives seats click priority, and hit-tests after zoom', async ({
  page,
  isMobile,
}) => {
  await mount(page, {
    seats: [{ id: 'A1', x: 20, y: 20, label: '1', category: 'red' }],
    categories: [{ id: 'red', label: 'Red', color: '#e15b64' }],
    background,
    outlines: [
      {
        id: 'ring',
        label: 'Ring',
        bounds: { x: 10, y: 10, width: 80, height: 80 },
        path: 'M10 10H90V90H10Z M40 40H60V60H40Z',
        fillRule: 'evenodd',
        fill: '#4c7a6d',
        strokeWidth: 0,
      },
    ],
  });
  await expect.poll(() => pixel(page, 30, 30)).toEqual([76, 122, 109]);
  await expect.poll(() => pixel(page, 55, 50)).toEqual([56, 121, 180]);
  await expect.poll(() => pixel(page, 24, 20)).toEqual([225, 91, 100]);
  const canvas = page.locator('#layer-fixture canvas[data-seatmap-layer=map]');
  const tap = async (x: number, y: number, zoom = 1) => {
    if (isMobile) await canvas.tap({ position: position(x, y, zoom) });
    else await canvas.click({ position: position(x, y, zoom) });
  };
  await tap(20, 20);
  expect(await page.evaluate(() => window.layerClient.snapshot.seatIds)).toEqual(['A1']);
  expect(await page.evaluate(() => window.outlineClicks)).toEqual([]);
  await tap(50, 50);
  expect(await page.evaluate(() => window.outlineClicks)).toEqual([]);
  await tap(30, 30);
  expect(await page.evaluate(() => window.outlineClicks)).toEqual(['ring']);
  expect(await page.evaluate(() => window.layerClient.snapshot.seatIds)).toEqual(['A1']);
  await page.evaluate(() => {
    window.layerRenderer.fit();
    window.layerRenderer.zoomIn();
  });
  await expect
    .poll(() => page.evaluate(() => window.layerRenderer.getViewport().scale))
    .toBeCloseTo(2.688 * 1.3, 4);
  await tap(20, 20, 1.3);
  expect(await page.evaluate(() => window.layerClient.snapshot.count)).toBe(0);
  await tap(30, 30, 1.3);
  expect(await page.evaluate(() => window.outlineClicks)).toEqual(['ring', 'ring']);
});

test('loads the demo SVG file and offers keyboard section navigation', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Explore a venue').selectOption('arena');
  await expect(page.getByRole('listbox')).toHaveAttribute('data-background-status', 'ready');
  await page.getByLabel('Section', { exact: true }).selectOption('2');
  await expect(page.getByLabel('Section', { exact: true })).toHaveValue('2');
  await expect(page.locator('#selected-count')).toHaveText('0 / 6');
  await page.getByRole('button', { name: 'Fit map', exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath('arena-layers.png'),
    fullPage: true,
    scale: 'css',
  });
});

test('keeps booking usable when the SVG file fails', async ({ page }) => {
  await page.route('**/missing-background.svg', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await mount(page, {
    seats: [{ id: 'A1', x: 50, y: 50, label: '1' }],
    background: { url: '/missing-background.svg', bounds },
  });
  await expect(page.locator('#layer-fixture [role="listbox"]')).toHaveAttribute(
    'data-background-status',
    'error',
  );
  await page.locator('#layer-fixture [role="listbox"]').press('Enter');
  expect(await page.evaluate(() => window.layerClient.snapshot.count)).toBe(1);
});

test('uses SVG image mode without inserting SVG nodes or executing scripts', async ({ page }) => {
  await mount(page, {
    seats: [],
    background: {
      bounds,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="window.svgExecuted=true"><script>window.svgExecuted=true</script><rect width="100" height="100" fill="#3879b4"/></svg>',
    },
  });
  await expect(page.locator('#layer-fixture [role="listbox"]')).toHaveAttribute(
    'data-background-status',
    'ready',
  );
  await expect.poll(() => pixel(page, 50, 50)).toEqual([56, 121, 180]);
  expect(await page.evaluate(() => window.svgExecuted)).toBeUndefined();
  await expect(page.locator('#layer-fixture svg')).toHaveCount(0);
});
