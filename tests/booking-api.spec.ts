import { test, expect } from '@playwright/test';
import type { SeatmapBookingRenderer, ICart } from '../src';

declare global {
  interface Window {
    bookingFixture: SeatmapBookingRenderer;
    bookingChanges: ICart[];
  }
}

test('uses the unchanged Booking constructor, loadEvent and callbacks with v2 pricing', async ({
  page,
}) => {
  await page.route('**/compat-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/assignments/')
      ? {
          version: '1',
          seatIds: [10, 1, 1],
          seatPriceRuns: [[1, 3]],
          seatPropertyIndexes: [],
          seatProperties: [],
          groupOfSeats: [],
          prices: [{ id: 1, name: '42.50' }],
        }
      : path.endsWith('/availability/')
        ? { version: '1', unavailableSeats: [], groupOfSeats: [], orphanPrevention: false }
        : path.endsWith('/rows/')
          ? '<svg xmlns="http://www.w3.org/2000/svg"/>'
          : {
              plainSeats: {
                ids: [10, 1, 1],
                x: [30, 24, 24],
                y: [40, 0, 0],
                rowIds: [5, 0, 0],
                sectorIds: [20, 0, 0],
                names: ['1', '2', '3'],
              },
              rows: [{ id: 5, sectorId: 20, rowNumber: 1, name: 'A', seatName: 'Seat' }],
              sectors: [{ id: 20, name: 'Mezzanine', isGa: false }],
              background: {
                viewBox: { x: 0, y: 0, width: 240, height: 110 },
                svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 110"><rect width="240" height="110" fill="#ddd"/></svg>',
                outlineSvg:
                  '<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10 20)"><rect data-gos-id="20" x="0" y="0" width="90" height="50" rx="5"/></g></svg>',
              },
            };
    await route.fulfill({
      contentType: typeof body === 'string' ? 'image/svg+xml' : 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240');
  await page.addScriptTag({ path: 'dist/renderer-ce.cjs' });
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'compat-fixture';
    host.style.cssText =
      'position:fixed;inset:0;width:320px;height:320px;z-index:1000;background:white';
    document.body.append(host);
    window.bookingChanges = [];
    window.bookingFixture = new window.SeatmapCE.SeatmapBookingRenderer(host, {
      publicKey: 'test-public-key',
      baseUrl: `${location.origin}/compat-api/public/v1.0/`,
      selectionLimit: 6,
      onSeatSelect: async (seat) => seat.id !== 11,
      onCartChange: (cart) => window.bookingChanges.push(cart),
    });
    await window.bookingFixture.loadEvent('event-id');
  });
  const map = page.locator('#compat-fixture [role=listbox]');
  await expect(map).toHaveAttribute('data-background-status', 'ready');
  await map.press('Enter');
  await map.press('ArrowRight');
  await map.press('Enter');
  await map.press('ArrowRight');
  await map.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.bookingFixture.getCart().seats.map((s) => s.id)))
    .toEqual([10, 12]);
  expect(await page.evaluate(() => window.bookingFixture.getCart().seats[0])).toMatchObject({
    id: 10,
    key: 'Mezzanine;;1;;1',
    price: 42.5,
  });
  const view = await page.evaluate(() => {
    const renderer = window.bookingFixture,
      before = renderer.getZoom(),
      bounds = renderer.getDataManager().getSectionMetadata(20)?.bounds?.toJSON();
    renderer.zoomToSection(20, { mode: 'scale', scale: 1.5 });
    return { before, after: renderer.getZoom(), bounds };
  });
  expect(view.after).toBe(view.before);
  await expect
    .poll(() => page.evaluate(() => window.bookingFixture.getZoom()))
    .toBeGreaterThan(view.before);
  expect(view.bounds).toMatchObject({ x: 10, y: 20, width: 90, height: 50 });
  const animation = await page.evaluate(async () => {
    const renderer = window.bookingFixture;
    renderer.zoomTo(1, { durationMs: 0 });
    renderer.zoomTo(2, { durationMs: 400 });
    const start = performance.now();
    const samples: number[] = [];
    while (performance.now() - start < 500) {
      await new Promise(requestAnimationFrame);
      samples.push(renderer.getZoom() / window.devicePixelRatio);
    }
    return samples;
  });
  expect(animation.some((scale) => scale > 1 && scale < 2)).toBe(true);
  expect(animation.at(-1)).toBeCloseTo(2, 5);
  await expect(page.locator('#compat-fixture svg')).toHaveCount(0);
  await page.evaluate(() => window.bookingFixture.destroy());
  await expect(map).toHaveCount(0);
});
