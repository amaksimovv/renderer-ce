import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ISchemaDTO } from '../src';
import { fixturePath } from './global-setup';
import type { SeatmapRenderer } from '../src/SeatmapRenderer';

declare global {
  interface Window {
    hoverFixture: SeatmapRenderer;
    hoverMetrics: { cacheArcs: number; mapDraws: number; overlayArcs: number };
  }
}

async function mount(page: Page, transparent = false) {
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240');
  await page.addScriptTag({ path: fixturePath });
  await page.evaluate((transparent) => {
    const host = document.createElement('div');
    host.id = 'hover-fixture';
    host.style.cssText =
      'position:fixed;left:0;top:0;width:320px;height:320px;z-index:1000;background:#0000ff';
    document.body.append(host);
    const client = new window.SeatmapCE.BookingClient({
      data: {
        seats: [
          { id: 1, x: 50, y: 50, label: '' },
          { id: 2, x: 75, y: 50, label: '' },
        ],
        background: {
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${transparent ? 'transparent' : '#0000ff'}"/></svg>`,
        },
        outlines: [
          {
            id: 'section',
            label: 'Section',
            path: 'M10 10H90V90H10Z',
            bounds: { x: 10, y: 10, width: 80, height: 80 },
            fill: 'transparent',
            stroke: '#000000',
          },
        ],
      },
    });
    window.hoverFixture = new window.SeatmapCE.SeatmapRenderer(host, {
      client,
      theme: { background: transparent ? 'transparent' : '#ffffff' },
      seatStyle: (_seat, state, style) => ({
        ...style,
        size: state === 'hovered' ? 8 : 16,
        color: state === 'hovered' ? (transparent ? 'rgba(0, 255, 0, 0.5)' : '#00ff00') : '#ff0000',
      }),
    });
  }, transparent);
  await expect(page.locator('#hover-fixture [role=listbox]')).toHaveAttribute(
    'data-background-status',
    'ready',
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function color(page: Page, worldX: number, worldY: number) {
  const snapshot = await page.locator('#hover-fixture').screenshot({ scale: 'css' });
  return page.evaluate(
    async ({ x, y, image }) => {
      const composite = document.createElement('canvas');
      const source = new Image();
      source.src = image;
      await source.decode();
      composite.width = source.width;
      composite.height = source.height;
      const ctx = composite.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
      const point = window.hoverFixture.getViewport().toScreen({ x, y });
      return [...ctx.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data].slice(0, 3);
    },
    { x: worldX, y: worldY, image: `data:image/png;base64,${snapshot.toString('base64')}` },
  );
}

async function hover(page: Page, x: number, y: number) {
  const position = await page.evaluate(
    ({ x, y }) => window.hoverFixture.getViewport().toScreen({ x, y }),
    { x, y },
  );
  await page.mouse.move(position.x, position.y);
}

test('preserves custom hover size, background, selection and viewport alignment', async ({
  page,
}) => {
  await mount(page);
  await expect.poll(() => color(page, 50, 50)).toEqual([255, 0, 0]);
  await hover(page, 50, 50);
  await expect.poll(() => color(page, 50, 50)).toEqual([0, 255, 0]);
  await expect.poll(() => color(page, 56, 50)).toEqual([0, 0, 255]);
  await hover(page, 75, 50);
  await expect.poll(() => color(page, 50, 50)).toEqual([255, 0, 0]);
  await expect.poll(() => color(page, 75, 50)).toEqual([0, 255, 0]);
  await page.mouse.move(350, 350);
  await expect.poll(() => color(page, 75, 50)).toEqual([255, 0, 0]);
  await page.evaluate(() => window.hoverFixture.zoomTo(2, { x: 50, y: 50 }, 0));
  await hover(page, 50, 50);
  await expect.poll(() => color(page, 50, 50)).toEqual([0, 255, 0]);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('#hover-fixture [role=option][aria-selected=true]')).toHaveCount(1);
  await page.mouse.move(350, 350);
  await expect.poll(() => color(page, 45, 47)).toEqual([255, 0, 0]);
  await page.evaluate(() => window.hoverFixture.destroy());
  await expect(page.locator('#hover-fixture canvas')).toHaveCount(0);
});

async function startMetrics(page: Page) {
  await page.evaluate(() => {
    window.hoverMetrics = { cacheArcs: 0, mapDraws: 0, overlayArcs: 0 };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (this.canvas instanceof HTMLCanvasElement) {
        if (!this.canvas.isConnected) window.hoverMetrics.cacheArcs++;
        else if (this.canvas.dataset.seatmapLayer === 'hover') window.hoverMetrics.overlayArcs++;
      }
      arc.apply(this, args);
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
      if (this.canvas instanceof HTMLCanvasElement && this.canvas.dataset.seatmapLayer === 'map')
        window.hoverMetrics.mapDraws++;
      Reflect.apply(draw, this, args);
    };
  });
}

test('hover changes never repaint the map projection', async ({ page }) => {
  await mount(page);
  await startMetrics(page);
  for (const x of [50, 75, 50, 75]) {
    await hover(page, x, 50);
    await page.waitForTimeout(65);
  }
  await hover(page, 20, 20);
  await page.waitForTimeout(65);
  await page.mouse.move(350, 350);
  const metrics = await page.evaluate(() => window.hoverMetrics);
  expect(metrics.cacheArcs).toBe(0);
  expect(metrics.mapDraws).toBe(0);
  expect(metrics.overlayArcs).toBeGreaterThan(0);
  expect(metrics.overlayArcs).toBeLessThan(40);
});

test('composites translucent hover over the background without exposing the cached seat', async ({
  page,
}) => {
  await mount(page, true);
  await hover(page, 50, 50);
  await expect.poll(() => color(page, 50, 50)).toEqual([0, 128, 127]);
  await expect.poll(() => color(page, 56, 50)).toEqual([0, 0, 255]);
  await page.mouse.move(350, 350);
  await expect.poll(() => color(page, 50, 50)).toEqual([255, 0, 0]);
  await expect(page.locator('#hover-fixture canvas[data-seatmap-layer=map]')).toHaveCSS(
    'mask-image',
    'none',
  );
});

test(
  'keeps the 19,608-seat Barclays projection unchanged while hovering across the venue',
  { tag: '@performance' },
  async ({ page }) => {
    await page.goto('/?venue=barclays');
    await expect(page.locator('#seat-count')).toContainText('19,608');
    const map = page.locator('#seatmap canvas[data-seatmap-layer=map]');
    await expect(page.getByRole('listbox')).toHaveAttribute('data-background-status', 'ready');
    await map.scrollIntoViewIfNeeded();
    const points = await map.evaluate(async (canvas) => {
      const schema = (await (await fetch('/maps/barclays.json')).json()) as ISchemaDTO;
      const box = canvas.getBoundingClientRect();
      const view = schema.background.viewBox;
      const scale = Math.min(1, Math.min(box.width / view.width, box.height / view.height) * 0.85);
      let x = 0,
        y = 0;
      const seats = schema.plainSeats
        ? schema.plainSeats.x.map((dx, index) => ({
            x: (x += dx),
            y: (y += schema.plainSeats!.y[index]!),
          }))
        : schema.seats;
      return seats
        .filter((_, index) => index % 900 === 0)
        .map((seat) => ({
          x: box.x + (box.width - view.width * scale) / 2 + seat.x * scale,
          y: box.y + (box.height - view.height * scale) / 2 + seat.y * scale,
        }));
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await startMetrics(page);
    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(60);
    }
    const metrics = await page.evaluate(() => window.hoverMetrics);
    console.log(JSON.stringify({ project: test.info().project.name, hover: metrics }));
    expect(metrics.cacheArcs).toBe(0);
    expect(metrics.mapDraws).toBe(0);
    expect(metrics.overlayArcs).toBeGreaterThan(5);
    expect(metrics.overlayArcs).toBeLessThan(100);
  },
);
