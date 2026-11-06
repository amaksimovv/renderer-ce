import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('selects seats with the keyboard and exports the actual cart', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240 seats');
  const map = page.getByRole('listbox');
  await map.focus();
  await map.press('Enter');
  await expect(page.locator('#selected-count')).toHaveText('1 / 6');
  await expect(page.locator('#total')).toHaveText('$85.00');
  await map.press('ArrowRight');
  await map.press('Enter');
  await expect(page.locator('#selected-count')).toHaveText('2 / 6');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selection' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const payload: unknown = JSON.parse(await readFile(path!, 'utf8'));
  expect(payload).toMatchObject({ seatIds: [1, 2], total: 17000, currency: 'USD' });
  await page.getByRole('button', { name: 'Remove Row A, seat 1', exact: true }).click();
  await expect(page.locator('#selected-count')).toHaveText('1 / 6');
  await expect(page.locator('#total')).toHaveText('$85.00');
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('demo.png'), fullPage: true });
});

test('list view enforces capacity and shares state with the map', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240 seats');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const seats = page.locator('#seat-list button:not([disabled])');
  for (let i = 0; i < 7; i++) await seats.nth(i).click();
  await expect(page.locator('#selected-count')).toHaveText('6 / 6');
  await expect(page.locator('#selection-feedback')).toContainText('Choose up to 6');
  await expect(seats.nth(6)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#seat-list button:disabled').first()).toBeDisabled();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toHaveCount(6);
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.getByRole('button', { name: 'Export selection' })).toBeDisabled();
});

test('switches venues, resets the cart, and fits small screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240 seats');
  await page.getByRole('listbox').focus();
  await page.getByRole('listbox').press('Enter');
  await page.getByLabel('Explore a venue').selectOption('arena');
  await expect(page.getByRole('heading', { name: 'Roundhouse Arena' })).toBeVisible();
  await expect(page.locator('#seat-count')).toHaveText('768 seats · 8 sections');
  await expect(page.locator('#selected-count')).toHaveText('0 / 6');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Fit map', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const canvas = await page.locator('canvas[data-seatmap-layer=map]').boundingBox();
  expect(canvas?.height).toBeGreaterThan(200);
  expect(canvas?.width).toBeGreaterThan(200);
});

test('pointer selection works and dragging does not select seats', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240 seats');
  const canvas = page.locator('canvas[data-seatmap-layer=map]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing canvas');
  const scale = Math.min(
    1,
    1 / (await page.evaluate(() => devicePixelRatio)),
    Math.min(box.width / 600, box.height / 470) * 0.85,
  );
  const position = {
    x: box.width / 2 + (60 - 300) * scale,
    y: box.height / 2 + (103 - 235) * scale,
  };
  if (isMobile) await canvas.tap({ position });
  else await canvas.click({ position });
  await expect(page.locator('#selected-count')).toHaveText('1 / 6');
  if (isMobile) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#selected-count')).toHaveText('1 / 6');
  await page.getByRole('button', { name: 'Fit map', exact: true }).click();
});
