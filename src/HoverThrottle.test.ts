import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HoverThrottle } from './HoverThrottle';

beforeEach(() => vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] }));
afterEach(() => vi.useRealTimers());

it('limits hover processing to 20 Hz and delivers the latest trailing position', () => {
  const callback = vi.fn();
  const hover = new HoverThrottle(callback);
  hover.update({ x: 1, y: 1 });
  expect(callback).toHaveBeenCalledExactlyOnceWith({ x: 1, y: 1 });
  for (let i = 2; i <= 25; i++) {
    vi.advanceTimersByTime(1);
    hover.update({ x: i, y: i });
  }
  expect(callback).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(26);
  expect(callback).toHaveBeenLastCalledWith({ x: 25, y: 25 });
  expect(callback).toHaveBeenCalledTimes(2);
});

it('clears hover immediately and discards pending positions on leave or pan', () => {
  const callback = vi.fn();
  const hover = new HoverThrottle(callback);
  hover.update({ x: 1, y: 1 });
  hover.update({ x: 2, y: 2 });
  hover.update(undefined);
  expect(callback).toHaveBeenLastCalledWith(undefined);
  vi.advanceTimersByTime(100);
  expect(callback).toHaveBeenCalledTimes(2);
  hover.update({ x: 3, y: 3 });
  expect(callback).toHaveBeenLastCalledWith({ x: 3, y: 3 });
});

it('cancels trailing work when the renderer is destroyed', () => {
  const callback = vi.fn();
  const hover = new HoverThrottle(callback);
  hover.update({ x: 1, y: 1 });
  hover.update({ x: 2, y: 2 });
  hover.cancel();
  vi.advanceTimersByTime(100);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
