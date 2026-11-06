import { paintSeat, resolveSeatStyle } from './seatPaint.js';
import type { ISeatStyle, SeatInteractionState } from './booking/models.js';
import type { BookingClient } from './BookingClient.js';
import type { SeatIndex, Viewport } from './geometry.js';
import type { Bounds, RendererTheme, Seat, SeatId } from './types.js';
import type { OutlineLayer } from './OutlineLayer.js';

export const defaultTheme: RendererTheme = {
  background: '#f5f3ed',
  seat: '#527f75',
  unavailable: '#d4d3cc',
  selected: '#20251f',
  text: '#333b34',
  selectedText: '#fff8df',
  shape: '#e3e1d8',
  focus: '#ae7100',
};

export type SeatPainter = (
  seat: Seat,
  state: SeatInteractionState,
  style: ISeatStyle,
) => ISeatStyle;

export interface PaintOptions {
  readonly seatStyle?: SeatPainter;
  readonly index: SeatIndex;
  readonly context: CanvasRenderingContext2D;
  readonly client: BookingClient;
  readonly viewport: Viewport;
  readonly theme: RendererTheme;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly radius: number;
  readonly selection?: boolean;
  readonly excludedSeats?: ReadonlySet<SeatId>;
  readonly region?: Bounds;
  readonly hoveredStyle?: ISeatStyle;
  readonly hovered?: SeatId;
  readonly backgroundImage?: HTMLImageElement;
  readonly outlines: OutlineLayer;
  readonly hoveredOutline?: string;
}

export function paint(options: PaintOptions): void {
  const {
    context: ctx,
    client,
    viewport: view,
    theme,
    width,
    height,
    pixelRatio,
    radius,
  } = options;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
  if (options.backgroundImage && client.data.background) {
    const { bounds, opacity } = client.data.background;
    ctx.save();
    ctx.globalAlpha = opacity ?? 1;
    ctx.drawImage(options.backgroundImage, bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const shape of client.data.shapes ?? []) {
    ctx.fillStyle = shape.fill ?? theme.shape;
    ctx.beginPath();
    ctx.roundRect(shape.x, shape.y, shape.width, shape.height, Math.min(8, shape.height / 4));
    ctx.fill();
    if (shape.label) {
      ctx.fillStyle = theme.text;
      ctx.font = '600 12px sans-serif';
      ctx.fillText(
        shape.label,
        shape.x + shape.width / 2,
        shape.y + shape.height / 2,
        shape.width - 8,
      );
    }
  }
  options.outlines.paint(ctx, view.scale, theme, options.hoveredOutline);
  for (const label of client.data.labels ?? []) {
    ctx.fillStyle = label.color ?? theme.text;
    ctx.font = `500 ${label.size ?? 12}px sans-serif`;
    ctx.fillText(label.text, label.x, label.y);
  }
  const categories = new Map(client.data.categories?.map((category) => [category.id, category]));
  const region = options.region ?? { x: 0, y: 0, width, height };
  const min = view.toWorld({
    x: region.x - radius * view.scale * 2,
    y: region.y - radius * view.scale * 2,
  });
  const max = view.toWorld({
    x: region.x + region.width + radius * view.scale * 2,
    y: region.y + region.height + radius * view.scale * 2,
  });
  const selected: { seat: Seat; style: ISeatStyle }[] = [];
  let hovered: { seat: Seat; style: ISeatStyle } | undefined;
  for (const seat of options.index.query({
    x: min.x,
    y: min.y,
    width: max.x - min.x,
    height: max.y - min.y,
  })) {
    if (options.excludedSeats?.has(seat.id)) continue;
    const style =
      seat.id === options.hovered && options.hoveredStyle
        ? options.hoveredStyle
        : resolveSeatStyle(
            options,
            seat,
            seat.category === undefined ? undefined : categories.get(seat.category)?.color,
          );
    if (seat.id === options.hovered) hovered = { seat, style };
    else if (options.selection !== false && client.isSelected(seat.id))
      selected.push({ seat, style });
    else paintSeat(options, seat, style);
  }
  for (const { seat, style } of selected) paintSeat(options, seat, style);
  if (hovered) paintSeat(options, hovered.seat, hovered.style);
}
