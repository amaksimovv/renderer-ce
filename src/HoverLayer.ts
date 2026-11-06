import {
  clearOverlay,
  coversNormal,
  createOverlay,
  paintPatch,
  seatRegion,
  transformOverlay,
} from './overlayPaint.js';
import type { PaintOptions } from './paint.js';
import { paintFocus, paintSeat, resolveSeatStyle } from './seatPaint.js';
import type { Bounds, Seat } from './types.js';

export class HoverLayer {
  readonly canvas = createOverlay('hover');
  private context = this.canvas.getContext('2d');

  constructor(private mapCanvas: HTMLCanvasElement) {}

  draw(base: PaintOptions, hovered?: Seat, focused?: Seat, outlineId?: string): Bounds[] {
    const ctx = this.context;
    if (!ctx) return [];
    clearOverlay(ctx, this.mapCanvas);
    const regions: Bounds[] = [];
    const options = { ...base, context: ctx, hovered: hovered?.id, hoveredOutline: outlineId };
    transformOverlay(options);
    if (outlineId) base.outlines.paintHover(ctx, base.viewport.scale, base.theme, outlineId);
    if (hovered) {
      const normal = resolveSeatStyle(base, hovered);
      const style = resolveSeatStyle(options, hovered);
      const changed = JSON.stringify(normal) !== JSON.stringify(style);
      if (changed && coversNormal(ctx, normal, style)) {
        paintSeat(options, hovered, style);
      } else if (changed) {
        const region = seatRegion(options, hovered, [normal, style]);
        const selected = base.client.snapshot.seats;
        const excluded = new Set([hovered.id, ...selected.map((seat) => seat.id)]);
        regions.push(region);
        paintPatch(options, region, excluded, () => {
          for (const seat of selected)
            if (seat.id !== hovered.id) paintSeat(options, seat, resolveSeatStyle(options, seat));
          paintSeat(options, hovered, style);
        });
      }
      transformOverlay(options);
      if (!changed) paintFocus(options, hovered, style.size / 2);
    }
    if (focused && focused.id !== hovered?.id)
      paintFocus(options, focused, resolveSeatStyle(options, focused).size / 2);
    return regions;
  }

  destroy(): void {
    this.canvas.remove();
    this.canvas.width = this.canvas.height = 0;
  }
}
