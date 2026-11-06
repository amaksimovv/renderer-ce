import { test, expect } from '@playwright/test';

test('renders the real Barclays map, explores sections and exports its booking cart', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const external: string[] = [];
  const booking: string[] = [];
  page.on('request', (request) => {
    if (/\/(?:api\/public|demo-api)\//.test(request.url())) booking.push(request.url());
    if (
      request.url().startsWith('http') &&
      !new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)
    )
      external.push(request.url());
  });
  await page.goto('/?venue=barclays');
  await expect(page.locator('#seat-count')).toHaveText('19,608 seats · 235 sections', {
    timeout: 30000,
  });
  const map = page.getByRole('listbox');
  await expect(map).toHaveAttribute('data-background-status', 'ready', { timeout: 30000 });
  await expect(map.locator('[role=option]')).toHaveCount(19608);
  await expect(page.locator('#section option')).toHaveCount(236);
  await page.screenshot({
    path: testInfo.outputPath('barclays-overview.png'),
    fullPage: true,
    scale: 'css',
  });
  await page.locator('#section').selectOption({ index: 1 });
  await map.focus();
  await map.press('Home');
  await map.press('Enter');
  await expect(page.locator('#selected-count')).toHaveText('1 / 6');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const available = page.locator('#seat-list button:not([disabled])');
  await expect(available.first()).toBeVisible();
  await expect(page.locator('#seat-list button')).not.toHaveCount(19608);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('#zoom-level')).toHaveText(/^[0-9]+%$/);
  await page.locator('#section').selectOption({ index: 2 });
  await expect
    .poll(async () => parseFloat((await page.locator('#zoom-level').textContent()) ?? '0'))
    .toBeGreaterThan(10);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect
    .poll(async () => parseFloat((await page.locator('#zoom-level').textContent()) ?? '0'))
    .toBeGreaterThan(10);
  await page.screenshot({
    path: testInfo.outputPath('barclays-section.png'),
    fullPage: true,
    scale: 'css',
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(booking).toEqual([]);
});
