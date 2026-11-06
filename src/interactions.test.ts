import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Viewport } from './geometry';
import { bindInteractions } from './interactions';

let canvas: HTMLCanvasElement;
let view: Viewport;
let cleanup: () => void;
const click = vi.fn();
const hover = vi.fn();
const redraw = vi.fn();

function pointer(type: string, x: number, y: number, id = 1): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: id });
  canvas.dispatchEvent(event);
}

beforeEach(() => {
  canvas = document.createElement('canvas');
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn().mockReturnValue(true);
  canvas.releasePointerCapture = vi.fn().mockImplementation((id: number) => {
    pointer('lostpointercapture', 0, 0, id);
  });
  view = new Viewport();
  cleanup = bindInteractions({ canvas, viewport: view, click, hover, redraw });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('pointer interactions', () => {
  it('selects exactly once even when releasing capture immediately fires lostpointercapture', () => {
    pointer('pointerdown', 10, 20);
    pointer('pointerup', 10, 20);
    expect(click).toHaveBeenCalledExactlyOnceWith({ x: 10, y: 20 });
  });

  it('does not select after a drag or an untracked pointerup', () => {
    pointer('pointerup', 10, 20);
    pointer('pointerdown', 10, 20);
    pointer('pointermove', 70, 100);
    pointer('pointerup', 70, 100);
    expect(click).not.toHaveBeenCalled();
    expect(view.x).toBe(60);
    expect(view.y).toBe(80);
  });

  it('does not select after a cancelled gesture', () => {
    pointer('pointerdown', 10, 20);
    pointer('pointercancel', 10, 20);
    pointer('pointerup', 10, 20);
    expect(click).not.toHaveBeenCalled();
  });

  it('pinches around the touch midpoint without selecting on release', () => {
    pointer('pointerdown', 0, 0, 1);
    pointer('pointerdown', 100, 0, 2);
    pointer('pointermove', 200, 0, 2);
    expect(view.scale).toBe(2);
    expect(view.toScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    pointer('pointerup', 200, 0, 2);
    pointer('pointerup', 0, 0, 1);
    expect(click).not.toHaveBeenCalled();
  });

  it('zooms on the wheel and detaches wheel and pointer listeners on cleanup', () => {
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 20, clientY: 40 }));
    const scale = view.scale;
    expect(scale).toBeGreaterThan(1);
    cleanup();
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
    pointer('pointerdown', 0, 0);
    pointer('pointerup', 0, 0);
    expect(view.scale).toBe(scale);
    expect(click).not.toHaveBeenCalled();
  });
});
