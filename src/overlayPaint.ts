import { paint } from './paint.js';
import type { PaintOptions } from './paint.js';
import { showsSeatName } from './seatPaint.js';
import type { ISeatStyle } from './booking/models.js';
import type { Bounds, Seat, SeatId } from './types.js';

export function createOverlay(name: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.dataset.seatmapLayer = name;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  return canvas;
}

export function clearOverlay(ctx: CanvasRenderingContext2D, map: HTMLCanvasElement): void {
  const canvas = ctx.canvas;
  if (canvas.width !== map.width || canvas.height !== map.height) {
    canvas.width = map.width;
    canvas.height = map.height;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function transformOverlay(options: PaintOptions): void {
  const { context: ctx, pixelRatio, viewport: view } = options;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
}

export function coversNormal(
  ctx: CanvasRenderingContext2D,
  normal: ISeatStyle,
  style: ISeatStyle,
): boolean {
  if (normal.shadow || style.size < normal.size + (normal.stroke?.width ?? 0) + 2) return false;
  ctx.save();
  ctx.fillStyle = style.color;
  const color = String(ctx.fillStyle);
  ctx.restore();
  return /^#[0-9a-f]{6}$/i.test(color) || color.startsWith('rgb(');
}

export function seatRegion(options: PaintOptions, seat: Seat, styles: ISeatStyle[]): Bounds {
  const { context: ctx, viewport: view, radius, width, height } = options;
  const point = view.toScreen(seat);
  ctx.save();
  const extent = Math.max(
    radius * view.scale + 5,
    ...styles.map((style) => {
      const size = Number.isFinite(style.size) && style.size > 0 ? style.size / 2 : radius;
      const shadow = style.shadow;
      let textExtent = 0;
      if (seat.label && showsSeatName(options, seat, style)) {
        ctx.font = style.seatName?.font ?? `600 ${radius * 0.95}px sans-serif`;
        const text = ctx.measureText(seat.label);
        textExtent =
          Math.max(text.actualBoundingBoxAscent, text.actualBoundingBoxDescent) * view.scale;
      }
      return Math.max(
        textExtent,
        (size + (style.stroke?.width ?? 0) / 2) * view.scale +
          (shadow
            ? (shadow.blur * 3 + Math.max(Math.abs(shadow.x ?? 0), Math.abs(shadow.y ?? 0))) *
              view.scale
            : 0) +
          2,
      );
    }),
  );
  ctx.restore();
  const x = Math.max(0, Math.floor(point.x - extent)),
    y = Math.max(0, Math.floor(point.y - extent));
  return {
    x,
    y,
    width: Math.max(0, Math.min(width, Math.ceil(point.x + extent)) - x),
    height: Math.max(0, Math.min(height, Math.ceil(point.y + extent)) - y),
  };
}

export function paintPatch(
  options: PaintOptions,
  region: Bounds,
  excludedSeats: ReadonlySet<SeatId>,
  overlay?: () => void,
): void {
  const ctx = options.context;
  ctx.save();
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.width, region.height);
  ctx.clip();
  ctx.clearRect(region.x, region.y, region.width, region.height);
  paint({
    ...options,
    selection: false,
    hovered: undefined,
    hoveredStyle: undefined,
    region,
    excludedSeats,
  });
  overlay?.();
  ctx.restore();
}

export function maskRegions(canvas: HTMLCanvasElement, regions: readonly Bounds[]): void {
  const style = canvas.style;
  if (!regions.length) {
    style.mask = '';
    return;
  }
  style.maskImage = Array.from(
    { length: regions.length + 1 },
    () => 'linear-gradient(#000 0 0)',
  ).join(', ');
  style.maskComposite = ['exclude', ...regions.map(() => 'add')].join(', ');
  style.maskRepeat = 'no-repeat';
  style.maskSize = [
    '100% 100%',
    ...regions.map((region) => `${region.width}px ${region.height}px`),
  ].join(', ');
  style.maskPosition = ['0 0', ...regions.map((region) => `${region.x}px ${region.y}px`)].join(
    ', ',
  );
}
