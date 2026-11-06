import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    zoomCacheDraws: number;
  }
}

test.use({ deviceScaleFactor: 2 });

test(
  'returns from a section through 100% to the cached Barclays overview twice',
  { tag: '@performance' },
  async ({ page }, info) => {
    await page.addInitScript(() => {
      window.zoomCacheDraws = 0;
      const arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (...args) {
        if (!this.canvas.isConnected) window.zoomCacheDraws++;
        arc.apply(this, args);
      };
    });
    await page.goto('/?venue=barclays');
    await expect(page.locator('#seat-count')).toContainText('19,608');
    await expect(page.getByRole('listbox')).toHaveAttribute('data-background-status', 'ready');
    await page.waitForTimeout(500);
    const overview = await page.locator('#zoom-level').textContent();
    await page.getByRole('listbox').focus();
    await page.getByRole('listbox').press('Enter');
    await expect(page.locator('#selected-count')).toHaveText('1 / 6');
    const rounds: { draws: number; maxFrameMs: number; frames: number; zooms: number }[] = [];
    for (let round = 0; round < 2; round++) {
      await page.locator('#section').selectOption({ index: 1 });
      await expect(page.locator('#zoom-level')).toHaveText('132%');
      await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
      await expect(page.locator('#zoom-level')).toHaveText('100%');
      await page.waitForTimeout(100);
      rounds.push(
        await page.evaluate(async () => {
          window.zoomCacheDraws = 0;
          let previous = performance.now();
          const start = previous;
          const frames: number[] = [];
          const zooms = new Set<string | null>();
          document.querySelector<HTMLButtonElement>('#zoom-out')!.click();
          while (performance.now() - start < 650) {
            await new Promise(requestAnimationFrame);
            const now = performance.now();
            frames.push(now - previous);
            zooms.add(document.querySelector('#zoom-level')!.textContent);
            previous = now;
          }
          return {
            p95Ms: [...frames].sort((a, b) => a - b)[Math.ceil(frames.length * 0.95) - 1]!,
            over50ms: frames.filter((ms) => ms > 50).length,
            draws: window.zoomCacheDraws,
            maxFrameMs: Math.max(...frames),
            frames: frames.length,
            zooms: zooms.size,
          };
        }),
      );
      await expect(page.locator('#zoom-level')).toHaveText(overview!);
    }
    await info.attach('overview-return-frames', {
      body: JSON.stringify(rounds),
      contentType: 'application/json',
    });
    console.log(JSON.stringify({ project: info.project.name, overview, rounds }));
    for (const round of rounds) {
      expect(round.draws).toBe(0);
      expect(round.zooms).toBeGreaterThan(3);
    }
    await expect(page.locator('#selected-count')).toHaveText('1 / 6');
  },
);
