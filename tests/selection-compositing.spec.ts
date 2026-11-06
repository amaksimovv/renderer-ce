import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BookingClient } from '../src/BookingClient';
import type { SeatmapRenderer } from '../src/SeatmapRenderer';
import { fixturePath } from './global-setup';

declare global {
  interface Window {
    selectionClient: BookingClient;
    selectionFixture: SeatmapRenderer;
  }
}

async function pixel(page: Page, x: number, y: number) {
  const image = await page.locator('#selection-fixture').screenshot({ scale: 'css' });
  return page.evaluate(
    async ({ x, y, image }) => {
      const source = new Image();
      source.src = image;
      await source.decode();
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
      const point = window.selectionFixture.getViewport().toScreen({ x, y });
      return [...ctx.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data].slice(0, 3);
    },
    { x, y, image: `data:image/png;base64,${image.toString('base64')}` },
  );
}

test('composites overlapping selection masks, hover and transparent backgrounds through zoom and deselection', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240');
  await page.addScriptTag({ path: fixturePath });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'selection-fixture';
    host.style.cssText =
      'position:fixed;left:0;top:0;width:320px;height:320px;z-index:1000;background:#0000ff';
    document.body.append(host);
    window.selectionClient = new window.SeatmapCE.BookingClient({
      data: {
        seats: [50, 60, 75].map((x, i) => ({ id: i + 1, x, y: 50, label: '' })),
        background: {
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>',
        },
      },
    });
    window.selectionFixture = new window.SeatmapCE.SeatmapRenderer(host, {
      client: window.selectionClient,
      theme: { background: 'transparent' },
      seatStyle: (_seat, state, base) => ({
        ...base,
        size: state === 'selected' ? 8 : state === 'hovered' ? 12 : 16,
        color:
          state === 'selected'
            ? 'rgba(0, 255, 0, 0.5)'
            : state === 'hovered'
              ? 'rgba(255, 255, 0, 0.5)'
              : '#ff0000',
      }),
    });
  });
  await expect(page.locator('#selection-fixture [role=listbox]')).toHaveAttribute(
    'data-background-status',
    'ready',
  );
  await expect.poll(() => pixel(page, 50, 50)).toEqual([255, 0, 0]);
  await page.evaluate(() => {
    window.selectionMetrics = { cacheArcs: 0, mapDraws: 0, selectionArcs: 0, ariaUpdates: 0 };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (!this.canvas.isConnected) window.selectionMetrics.cacheArcs++;
      arc.apply(this, args);
    };
    window.selectionClient.select(1);
    window.selectionClient.select(2);
  });
  await expect.poll(() => pixel(page, 48, 48)).toEqual([0, 128, 127]);
  expect(await pixel(page, 58, 48)).toEqual([0, 128, 127]);
  expect(await pixel(page, 44, 50)).toEqual([0, 0, 255]);
  expect(await pixel(page, 55, 50)).toEqual([0, 0, 255]);
  expect(await page.evaluate(() => window.selectionMetrics.cacheArcs)).toBe(0);
  const hover = await page.evaluate(() =>
    window.selectionFixture.getViewport().toScreen({ x: 75, y: 50 }),
  );
  await page.mouse.move(hover.x, hover.y);
  await expect.poll(() => pixel(page, 75, 50)).toEqual([128, 128, 127]);
  expect(await pixel(page, 58, 48)).toEqual([0, 128, 127]);
  await page.mouse.move(350, 350);
  await expect.poll(() => pixel(page, 75, 50)).toEqual([255, 0, 0]);
  await page.evaluate(() => window.selectionFixture.zoomTo(1.5, { x: 50, y: 50 }, 150));
  await expect.poll(() => pixel(page, 48, 48)).toEqual([0, 128, 127]);
  const beforeClear = await page.evaluate(() => window.selectionMetrics.cacheArcs);
  await page.evaluate(() => window.selectionClient.clear());
  await expect.poll(() => pixel(page, 50, 50)).toEqual([255, 0, 0]);
  expect(await pixel(page, 60, 50)).toEqual([255, 0, 0]);
  expect(await page.evaluate(() => window.selectionMetrics.cacheArcs)).toBe(beforeClear);
  await expect(page.locator('#selection-fixture canvas[data-seatmap-layer=map]')).toHaveCSS(
    'mask-image',
    'none',
  );
  await page.evaluate(() => window.selectionFixture.destroy());
  await expect(page.locator('#selection-fixture canvas')).toHaveCount(0);
});
