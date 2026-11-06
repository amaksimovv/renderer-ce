import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SeatmapBookingRenderer, ISchemaDTO, IPriceListDTO } from '../src';
import { fixturePath } from './global-setup';

declare global {
  interface Window {
    styledRenderer: SeatmapBookingRenderer;
    styleDraws: { map: number; overlay: number };
  }
}

async function pixel(page: Page, x: number, y: number) {
  const screenshot = await page.locator('#styles-fixture').screenshot({ scale: 'css' });
  return page.evaluate(
    async ({ image, x, y }) => {
      const source = new Image();
      source.src = image;
      await source.decode();
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
      return [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    },
    { image: `data:image/png;base64,${screenshot.toString('base64')}`, x, y },
  );
}

test('renders booking seat sizes, labels and selection above neighboring seats without repainting on hover', async ({
  page,
}, info) => {
  const schema: ISchemaDTO = {
    seats: [80, 102, 200, 280].map((x, index) => ({
      id: index + 1,
      x,
      y: 110,
      name: '12',
      rowId: 1,
      sectorId: 1,
      isAccessible: index === 3,
    })),
    rows: [{ id: 1, sectorId: 1, name: 'A', rowNumber: 1, seatName: 'Seat' }],
    sectors: [{ id: 1, name: 'Balcony', isGa: false }],
    background: { viewBox: { x: 0, y: 0, width: 360, height: 300 } },
  };
  const prices: IPriceListDTO = {
    seats: [
      [1, 1],
      [2, 2],
      [4, 2],
    ],
    prices: [
      { id: 1, name: '35' },
      { id: 2, name: '55' },
    ],
    groupOfSeats: [],
    orphanPrevention: false,
  };
  await page.route('**/styles-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/v2.0/')) await route.fulfill({ status: 404, json: {} });
    else if (path.endsWith('/prices/')) await route.fulfill({ json: prices });
    else if (path.endsWith('/rows/')) await route.fulfill({ body: '' });
    else await route.fulfill({ json: schema });
  });
  await page.goto('/');
  await page.addScriptTag({ path: fixturePath });
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'styles-fixture';
    host.style.cssText =
      'position:fixed;top:0;left:0;width:360px;height:300px;z-index:1000;background:#fff';
    document.body.append(host);
    window.styledRenderer = new window.SeatmapCE.SeatmapBookingRenderer(host, {
      publicKey: 'styles-test',
      baseUrl: '/styles-api/v1.0/',
      initialPadding: 1,
      padding: 0,
      zoomAnimationDuration: 0,
      orphanPrevention: false,
      theme: { bgColor: '#fff', priceColors: [['#ff0000', '#0000ff']] },
    });
    await window.styledRenderer.loadEvent('styles');
  });
  await expect.poll(() => pixel(page, 86, 110)).toEqual([255, 0, 0]);
  expect(await pixel(page, 90, 110)).toEqual([255, 255, 255]);
  expect(await pixel(page, 200, 110)).toEqual([187, 187, 187]);
  expect(await pixel(page, 205, 110)).toEqual([255, 255, 255]);
  expect(await pixel(page, 291, 110)).toEqual([0, 0, 255]);
  await page.evaluate(() => {
    window.styleDraws = { map: 0, overlay: 0 };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (!this.canvas.isConnected) window.styleDraws.map++;
      if (this.canvas.dataset.seatmapLayer === 'hover') window.styleDraws.overlay++;
      arc.apply(this, args);
    };
  });
  await page.mouse.move(80, 110);
  await expect.poll(() => pixel(page, 96, 110)).toEqual([255, 0, 0]);
  expect(await pixel(page, 97, 110)).toEqual([255, 0, 0]);
  await expect(page.locator('#styles-fixture canvas[data-seatmap-layer=map]')).toHaveCSS(
    'mask-image',
    'none',
  );
  expect(await page.evaluate(() => window.styleDraws)).toEqual({ map: 0, overlay: 1 });
  const textPixels = await page
    .locator('#styles-fixture canvas[data-seatmap-layer=hover]')
    .evaluate((canvas) => {
      const ctx = (canvas as HTMLCanvasElement).getContext('2d')!;
      const ratio = (canvas as HTMLCanvasElement).width / 360;
      const pixels = ctx.getImageData(70 * ratio, 101 * ratio, 20 * ratio, 18 * ratio).data;
      let white = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i]! > 230 &&
          pixels[i + 1]! > 230 &&
          pixels[i + 2]! > 230 &&
          pixels[i + 3]! > 230
        )
          white++;
      return white;
    });
  expect(textPixels).toBeGreaterThan(10);
  await page.mouse.move(350, 280);
  await page.evaluate(() => window.styledRenderer.addSeatsToCart([{ id: 1, key: '' }]));
  await expect.poll(() => pixel(page, 98, 110)).toEqual([255, 0, 0]);
  expect(await page.evaluate(() => window.styleDraws.map)).toBe(0);
  const shadow = await pixel(page, 80, 135);
  expect(shadow[0]).toBeLessThan(255);
  expect(shadow[0]).toBeGreaterThan(150);
  await page.mouse.move(102, 110);
  await page.screenshot({ path: info.outputPath('booking-seat-styles.png') });
});
