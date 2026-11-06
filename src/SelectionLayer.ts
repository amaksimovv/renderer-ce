import {
  clearOverlay,
  coversNormal,
  createOverlay,
  paintPatch,
  seatRegion,
  transformOverlay,
} from './overlayPaint.js';
import { paintSeat, resolveSeatStyle } from './seatPaint.js';
import type { PaintOptions } from './paint.js';
import type { Bounds } from './types.js';

export class SelectionLayer {
  readonly canvas = createOverlay('selection');
  private context = this.canvas.getContext('2d');
  regions: Bounds[] = [];

  constructor(private mapCanvas: HTMLCanvasElement) {}

  draw(base: PaintOptions): void {
    const ctx = this.context;
    if (!ctx) return;
    clearOverlay(ctx, this.mapCanvas);
    const options = { ...base, context: ctx };
    const seats = base.client.snapshot.seats;
    const excluded = new Set(seats.map((seat) => seat.id));
    this.regions = [];
    const selected = seats.flatMap((seat) => {
      const normal = resolveSeatStyle({ ...options, selection: false }, seat);
      const style = resolveSeatStyle(options, seat);
      const region = seatRegion(options, seat, [normal, style]);
      if (!region.width || !region.height) return [];
      if (!coversNormal(ctx, normal, style)) this.regions.push(region);
      return [{ seat, style }];
    });
    for (const region of this.regions) paintPatch(options, region, excluded);
    transformOverlay(options);
    for (const { seat, style } of selected) paintSeat(options, seat, style);
  }

  destroy(): void {
    this.canvas.remove();
    this.canvas.width = this.canvas.height = 0;
    this.regions = [];
  }
}
