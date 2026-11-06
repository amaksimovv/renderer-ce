import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Viewport } from './geometry';
import { ViewportAnimation } from './ViewportAnimation';

const frames = new Map<number, FrameRequestCallback>();
let sequence = 0;
let time = 0;

beforeEach(() => {
  time = 0;
  frames.clear();
  vi.spyOn(performance, 'now').mockImplementation(() => time);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function tick(now: number): void {
  time = now;
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(now));
}

it('interpolates the viewport and lands exactly on its destination', async () => {
  const view = new Viewport();
  const redraw = vi.fn();
  const animation = new ViewportAnimation(view, redraw);
  const done = animation.to({ x: -100, y: -50, scale: 2 }, 400);
  expect(view.scale).toBe(1);
  tick(200);
  expect(view.scale).toBeGreaterThan(1);
  expect(view.scale).toBeLessThan(2);
  tick(400);
  await done;
  expect(view).toMatchObject({ x: -100, y: -50, scale: 2 });
  expect(animation.active).toBe(false);
  expect(frames.size).toBe(0);
});

it('resolves interrupted animations without moving the view after pan begins', async () => {
  const view = new Viewport();
  const animation = new ViewportAnimation(view, vi.fn());
  const done = animation.to({ x: 100, y: 200, scale: 3 }, 400);
  tick(100);
  animation.cancel();
  await done;
  view.x += 40;
  const panned = { ...view };
  tick(500);
  expect(view).toEqual(panned);
});

it('settles replaced animations and honors reduced motion', async () => {
  const view = new Viewport();
  const animation = new ViewportAnimation(view, vi.fn());
  const first = animation.to({ x: 10, y: 10, scale: 2 }, 400);
  const second = animation.to({ x: 20, y: 20, scale: 3 }, 400);
  await first;
  tick(400);
  await second;
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  await animation.to({ x: 0, y: 0, scale: 1 }, 400);
  expect(view.scale).toBe(1);
  expect(frames.size).toBe(0);
});
