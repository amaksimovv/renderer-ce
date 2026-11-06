import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    projectionSeatDraws: number;
    panBlits: number;
    panPointerId: number;
  }
}

test(
  'pans Barclays at 14% without repainting seats inside the projection window',
  { tag: '@performance' },
  async ({ page, isMobile }) => {
    await page.addInitScript(() => {
      window.projectionSeatDraws = 0;
      window.panBlits = 0;
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
        if (this.canvas.dataset.seatmapLayer === 'map') window.panBlits++;
        Reflect.apply(draw, this, args);
      };
      const original = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (...args) {
        window.projectionSeatDraws++;
        original.apply(this, args);
      };
    });
    await page.goto('/?venue=barclays');
    await expect(page.locator('#seat-count')).toContainText('19,608');
    await expect(page.getByRole('listbox')).toHaveAttribute('data-background-status', 'ready');
    const canvas = page.locator('#seatmap canvas').first();
    await canvas.scrollIntoViewIfNeeded();
    const point = await canvas.evaluate((layer) => {
      const box = layer.getBoundingClientRect();
      for (const y of [0.5, 0.35, 0.65])
        for (const x of [0.5, 0.3, 0.7]) {
          const px = box.left + x * box.width,
            py = box.top + y * box.height;
          if (document.elementFromPoint(px, py) === layer) return { x: px, y: py };
        }
      throw new Error('No visible map surface for pan');
    });
    for (let attempt = 0; attempt < 6; attempt++) {
      const zoom = parseInt((await page.locator('#zoom-level').textContent())!);
      if (zoom === 14) break;
      await canvas.dispatchEvent('wheel', {
        clientX: point.x,
        clientY: point.y,
        deltaY: Math.log(zoom / 14) / 0.003,
      });
      await page.waitForTimeout(450);
    }
    await expect(page.locator('#zoom-level')).toHaveText('14%');
    await canvas.evaluate((layer) => {
      layer.addEventListener(
        'pointerdown',
        (ev) => {
          window.panPointerId = (ev as PointerEvent).pointerId;
        },
        { once: true },
      );
    });
    const touch = isMobile ? await page.context().newCDPSession(page) : undefined;
    if (touch)
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    else {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
    }
    await expect.poll(() => page.evaluate(() => window.panPointerId)).toBeGreaterThan(0);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const metrics = await canvas.evaluate(async (layer, start) => {
      const pointer = (x: number) =>
        layer.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerId: window.panPointerId,
            buttons: 1,
            clientX: start.x + x,
            clientY: start.y,
          }),
        );
      const tick = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
      let previous = await tick();
      window.projectionSeatDraws = window.panBlits = 0;
      const frames: number[] = [];
      for (let frame = 0; frame < 120; frame++) {
        pointer(10 + 40 * Math.sin((frame * Math.PI) / 60));
        const now = await tick();
        frames.push(now - previous);
        previous = now;
      }
      frames.sort((a, b) => a - b);
      return {
        seatDraws: window.projectionSeatDraws,
        blits: window.panBlits,
        frames: frames.length,
        medianMs: frames[59],
        p95Ms: frames[113],
        maxMs: frames[119],
        over50ms: frames.filter((ms) => ms > 50).length,
      };
    }, point);
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    } else await page.mouse.up();
    console.log(JSON.stringify({ project: test.info().project.name, pan14: metrics }));
    expect(metrics.blits).toBeGreaterThan(90);
    expect(metrics.seatDraws).toBe(0);
  },
);

test('zooms back to the full Barclays map using its retained detailed raster', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    window.projectionSeatDraws = 0;
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      window.projectionSeatDraws++;
      arc.apply(this, args);
    };
  });
  await page.goto('/?venue=barclays');
  await expect(page.locator('#seat-count')).toContainText('19,608');
  await expect(page.getByRole('listbox')).toHaveAttribute('data-background-status', 'ready');
  await page.locator('#section').selectOption({ index: 1 });
  await page.waitForTimeout(550);
  const samples = await page.evaluate(async () => {
    let previousDraws = window.projectionSeatDraws;
    let previousTime = performance.now();
    const frames: { ms: number; draws: number; zoom: string | null }[] = [];
    document.querySelector<HTMLButtonElement>('#fit')!.click();
    const start = performance.now();
    while (performance.now() - start < 600) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      frames.push({
        ms: now - previousTime,
        draws: window.projectionSeatDraws - previousDraws,
        zoom: document.querySelector('#zoom-level')!.textContent,
      });
      previousDraws = window.projectionSeatDraws;
      previousTime = now;
    }
    return frames;
  });
  const redraws = samples.filter((s) => s.draws > 0);
  await info.attach('zoom-frames', {
    body: JSON.stringify(samples),
    contentType: 'application/json',
  });
  expect(redraws).toHaveLength(0);
  expect(new Set(samples.map((s) => s.zoom)).size).toBeGreaterThan(3);
  expect(samples.filter((s) => s.draws === 0).length).toBeGreaterThan(8);
});

test(
  'moves the cached Barclays map throughout a continuous wheel gesture',
  { tag: '@performance' },
  async ({ page }) => {
    await page.goto('/?venue=barclays');
    const map = page.getByRole('listbox');
    await expect(map).toHaveAttribute('data-background-status', 'ready');
    const result = await map.locator('canvas[data-seatmap-layer=map]').evaluate(async (canvas) => {
      const rect = canvas.getBoundingClientRect();
      const options = {
        deltaY: -1.5,
        clientX: rect.x + rect.width * 0.6,
        clientY: rect.y + rect.height * 0.4,
        cancelable: true,
      };
      const context = (canvas as HTMLCanvasElement).getContext('2d')!;
      const widths = new Set<number>();
      const original = context.drawImage;
      context.drawImage = function (...args: unknown[]) {
        if (typeof args[3] === 'number') widths.add(args[3]);
        Reflect.apply(original, this, args);
      };
      const wheel = window.setInterval(
        () => canvas.dispatchEvent(new WheelEvent('wheel', options)),
        4,
      );
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return widths.size;
      } finally {
        clearInterval(wheel);
        context.drawImage = original;
      }
    });
    expect(result).toBeGreaterThan(6);
  },
);
