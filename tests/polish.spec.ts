import { expect, test } from '@playwright/test';

test('keeps the section and zoom when switching between map and list', async ({ page }) => {
  await page.goto('/?venue=barclays');
  await expect(page.locator('#seat-count')).toContainText('19,608');
  await page.locator('#section').selectOption({ index: 1 });
  await page.waitForTimeout(500);
  const zoom = await page.locator('#zoom-level').textContent();
  const section = await page.locator('#section').inputValue();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.locator('#seat-list')).toBeVisible();
  await expect(page.locator('#seat-list legend').nth(1)).toContainText('Row 2');
  const labels = await page
    .locator('#seat-list fieldset')
    .first()
    .locator('button')
    .allTextContents();
  expect(labels.map(Number)).toEqual([...labels.map(Number)].sort((a, b) => a - b));
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.locator('#zoom-level')).toHaveText(zoom!);
  await expect(page.locator('#section')).toHaveValue(section);
  await expect(page.getByRole('listbox').getByRole('option').first()).not.toHaveAttribute(
    'aria-label',
    /Row Row/,
  );
});

test('shows venue loading and recovers from a failed local file without reloading the page', async ({
  page,
}) => {
  let fail = true;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/maps/barclays.json', async (route) => {
    if (fail) {
      await pending;
      await route.fulfill({ status: 503, body: '' });
    } else await route.continue();
  });
  await page.goto('/?venue=barclays');
  await expect(page.locator('#venue-status-title')).toHaveText('Loading Barclays Center…');
  await expect(page.locator('#venue-content')).toHaveAttribute('inert', '');
  release();
  await expect(page.locator('#venue-status-title')).toHaveText("Couldn't load Barclays Center");
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#seat-count')).toHaveText('19,608 seats · 235 sections');
  await expect(page.locator('#venue-status')).toBeHidden();
  await expect(page.locator('#venue-content')).not.toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
});

test('keeps the layout usable from a narrow phone to a wide desktop', async ({ page }, info) => {
  await page.goto('/?venue=barclays');
  await expect(page.locator('#seat-count')).toContainText('19,608');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.locator('#playground').scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      targets: [
        ...document.querySelectorAll<HTMLElement>(
          '#venue, #section, .view-switch button, .zoom-controls button',
        ),
      ].map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    }));
    expect(layout.width).toBeLessThanOrEqual(layout.viewport);
    for (const target of layout.targets) {
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: info.outputPath(`lookfeel-${width}.png`), fullPage: true });
    if (width === 1440)
      await page
        .locator('#playground')
        .screenshot({ path: info.outputPath('lookfeel-playground.png') });
  }
});

test('offers a mobile shortcut to the selection and hides it when the cart is visible', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Mobile selection summary');
  await page.goto('/');
  await expect(page.locator('#seat-count')).toContainText('240 seats');
  const map = page.getByRole('listbox');
  await map.focus();
  await map.press('Enter');
  await page.locator('.map-topline').scrollIntoViewIfNeeded();
  await expect(page.locator('#selection-summary')).toBeVisible();
  await expect(page.locator('#selection-summary-value')).toHaveText('1 seat · $85.00');
  await page.getByRole('link', { name: /Review selection/ }).click();
  await expect(page.locator('#cart')).toBeFocused();
  await expect(page.locator('#selection-summary')).toBeHidden();
  await expect(page.locator('#cart-items')).toContainText('Row A, seat 1');
});

test('uses a valid default venue for an unknown URL value', async ({ page }) => {
  await page.goto('/?venue=missing');
  await expect(page.locator('#venue')).toHaveValue('theatre');
  await expect(page.locator('#demo-title')).toHaveText('Meridian Hall');
  await expect(page.locator('#seat-count')).toContainText('240 seats');
});
