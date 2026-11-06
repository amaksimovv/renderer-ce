import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    selectionMetrics: {
      cacheArcs: number;
      mapDraws: number;
      selectionArcs: number;
      ariaUpdates: number;
    };
  }
}

test(
  'selects, deselects and clears Barclays seats without repainting the map or rewriting every option',
  { tag: '@performance' },
  async ({ page }, info) => {
    await page.goto('/?venue=barclays');
    await expect(page.locator('#seat-count')).toContainText('19,608');
    const map = page.getByRole('listbox');
    await expect(map).toHaveAttribute('data-background-status', 'ready');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      window.selectionMetrics = { cacheArcs: 0, mapDraws: 0, selectionArcs: 0, ariaUpdates: 0 };
      const arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (...args) {
        if (!this.canvas.isConnected) window.selectionMetrics.cacheArcs++;
        if (this.canvas.dataset.seatmapLayer === 'selection')
          window.selectionMetrics.selectionArcs++;
        arc.apply(this, args);
      };
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
        if (this.canvas.dataset.seatmapLayer === 'map') window.selectionMetrics.mapDraws++;
        Reflect.apply(draw, this, args);
      };
      new MutationObserver((records) => {
        window.selectionMetrics.ariaUpdates += records.length;
      }).observe(document.querySelector('#seatmap')!, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-selected'],
      });
    });
    await map.focus();
    await map.press('Enter');
    await expect(page.locator('#selected-count')).toHaveText('1 / 6');
    await map.press('Enter');
    await expect(page.locator('#selected-count')).toHaveText('0 / 6');
    await map.press('Enter');
    await expect(page.locator('#selected-count')).toHaveText('1 / 6');
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await expect(page.locator('#selected-count')).toHaveText('0 / 6');
    const metrics = await page.evaluate(() => window.selectionMetrics);
    await info.attach('selection-draws', {
      body: JSON.stringify(metrics),
      contentType: 'application/json',
    });
    console.log(JSON.stringify({ project: info.project.name, metrics }));
    expect(metrics.cacheArcs).toBe(0);
    expect(metrics.mapDraws).toBe(0);
    expect(metrics.selectionArcs).toBeGreaterThan(0);
    expect(metrics.selectionArcs).toBeLessThan(20);
    expect(metrics.ariaUpdates).toBe(4);
  },
);
