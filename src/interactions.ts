import type { Viewport } from './geometry.js';
import type { Point } from './types.js';
import { HoverThrottle } from './HoverThrottle.js';

interface InteractionOptions {
  readonly canvas: HTMLCanvasElement;
  readonly viewport: Viewport;
  readonly click: (point: Point) => void;
  readonly hover: (point: Point | undefined) => void;
  readonly redraw: () => void;
  readonly interrupt?: () => void;
  readonly zoom?: (factor: number, anchor: Point) => void;
}

export function bindInteractions(options: InteractionOptions): () => void {
  const { canvas, viewport, click, redraw } = options;
  const hoverThrottle = new HoverThrottle(options.hover);
  const hover = (point: Point | undefined) => hoverThrottle.update(point);
  const controller = new AbortController();
  const { signal } = controller;
  const pointers = new Map<number, Point>();
  let origin: Point | undefined;
  let moved = false;

  const position = (event: MouseEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const gesture = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return undefined;
    return {
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    };
  };
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      hover(undefined);
      canvas.parentElement?.focus({ preventScroll: true });
      options.interrupt?.();
      const point = position(event);
      pointers.set(event.pointerId, point);
      canvas.setPointerCapture(event.pointerId);
      if (pointers.size === 1) {
        origin = point;
        moved = false;
      } else moved = true;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      const point = position(event);
      const previous = pointers.get(event.pointerId);
      if (!previous) {
        hover(point);
        return;
      }
      const before = gesture();
      pointers.set(event.pointerId, point);
      const after = gesture();
      if (before && after) {
        if (before.distance > 0) viewport.zoom(after.distance / before.distance, before.center);
        viewport.x += after.center.x - before.center.x;
        viewport.y += after.center.y - before.center.y;
        moved = true;
      } else {
        if (origin && Math.hypot(point.x - origin.x, point.y - origin.y) > 5) moved = true;
        if (moved) {
          viewport.x += point.x - previous.x;
          viewport.y += point.y - previous.y;
        }
      }
      if (moved) {
        canvas.style.cursor = 'grabbing';
        hover(undefined);
        redraw();
      }
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerup',
    (event) => {
      const shouldSelect = pointers.has(event.pointerId) && !moved;
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (shouldSelect) click(position(event));
      if (pointers.size === 0) {
        origin = undefined;
        canvas.style.cursor = 'grab';
      }
    },
    { signal },
  );
  const cancel = (event: PointerEvent) => {
    hover(undefined);
    pointers.delete(event.pointerId);
    moved = true;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointercancel', cancel, { signal });
  canvas.addEventListener('lostpointercapture', cancel, { signal });
  canvas.addEventListener(
    'pointerleave',
    () => {
      hover(undefined);
    },
    { signal },
  );
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      const factor = Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.003);
      if (options.zoom) options.zoom(factor, position(event));
      else {
        viewport.zoom(factor, position(event));
        redraw();
      }
      hover(undefined);
    },
    { signal, passive: false },
  );
  return () => {
    hoverThrottle.cancel();
    controller.abort();
    pointers.clear();
  };
}
