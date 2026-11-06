import type { ISeatStyle } from './booking/models.js';
import type { PaintOptions } from './paint.js';
import type { Seat } from './types.js';

export function resolveSeatStyle(
  options: PaintOptions,
  seat: Seat,
  categoryColor?: string,
): ISeatStyle {
  const { client, theme, radius } = options;
  const selected = options.selection !== false && client.isSelected(seat.id);
  const unavailable = seat.status === 'unavailable';
  const color = unavailable
    ? theme.unavailable
    : selected
      ? theme.selected
      : (categoryColor ??
        client.data.categories?.find((category) => category.id === seat.category)?.color ??
        theme.seat);
  const state = unavailable
    ? 'unavailable'
    : selected
      ? 'selected'
      : seat.id === options.hovered
        ? 'hovered'
        : 'default';
  options.context.fillStyle = color;
  const base = { color: String(options.context.fillStyle), size: radius * 2 };
  return options.seatStyle?.(seat, state, base) ?? base;
}

export function paintSeat(options: PaintOptions, seat: Seat, style: ISeatStyle): void {
  const { context: ctx, client, viewport: view, theme, radius } = options;
  const selected = options.selection !== false && client.isSelected(seat.id);
  const unavailable = seat.status === 'unavailable';
  const seatRadius = Number.isFinite(style.size) && style.size > 0 ? style.size / 2 : radius;
  ctx.save();
  ctx.fillStyle = style.color;
  if (style.shadow) {
    ctx.shadowBlur = style.shadow.blur * view.scale * options.pixelRatio;
    ctx.shadowColor = style.shadow.color;
    ctx.shadowOffsetX = (style.shadow.x ?? 0) * view.scale * options.pixelRatio;
    ctx.shadowOffsetY = (style.shadow.y ?? 0) * view.scale * options.pixelRatio;
  }
  ctx.beginPath();
  ctx.arc(seat.x, seat.y, seatRadius, 0, Math.PI * 2);
  ctx.fill();
  if (style.stroke) {
    ctx.strokeStyle = style.stroke.color;
    ctx.lineWidth = style.stroke.width;
    ctx.stroke();
  }
  ctx.restore();
  if (selected) drawCheck(ctx, seat, seatRadius, theme.selectedText);
  else if (unavailable && seatRadius * view.scale >= 6) {
    ctx.strokeStyle = theme.background;
    ctx.lineWidth = 1.5 / view.scale;
    ctx.beginPath();
    ctx.moveTo(seat.x - seatRadius * 0.35, seat.y);
    ctx.lineTo(seat.x + seatRadius * 0.35, seat.y);
    ctx.stroke();
  } else if (seat.accessible && !unavailable && !style.seatName) {
    drawAccessible(ctx, seat, seatRadius, theme.selectedText);
  } else if (showsSeatName(options, seat, style)) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.seatName?.color ?? theme.background;
    ctx.font = style.seatName?.font ?? `600 ${radius * 0.95}px sans-serif`;
    ctx.fillText(seat.label, seat.x, seat.y, seatRadius * 1.5);
  }
}

export function showsSeatName(options: PaintOptions, seat: Seat, style: ISeatStyle): boolean {
  const size = Number.isFinite(style.size) && style.size > 0 ? style.size / 2 : options.radius;
  return (
    seat.status !== 'unavailable' &&
    (options.selection === false || !options.client.isSelected(seat.id)) &&
    size * options.viewport.scale >= (style.seatName ? 6 : 13)
  );
}

export function paintFocus(options: PaintOptions, seat: Seat, radius = options.radius): void {
  const { context: ctx, theme, viewport: view } = options;
  ctx.save();
  ctx.strokeStyle = theme.focus;
  ctx.lineWidth = 2 / view.scale;
  ctx.beginPath();
  ctx.arc(seat.x, seat.y, radius + 3 / view.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCheck(ctx: CanvasRenderingContext2D, seat: Seat, radius: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * 0.19;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(seat.x - radius * 0.4, seat.y);
  ctx.lineTo(seat.x - radius * 0.1, seat.y + radius * 0.3);
  ctx.lineTo(seat.x + radius * 0.42, seat.y - radius * 0.35);
  ctx.stroke();
}

function drawAccessible(
  ctx: CanvasRenderingContext2D,
  seat: Seat,
  radius: number,
  color: string,
): void {
  const scale = Math.min(18, radius * 1.4) / 24;
  ctx.save();
  ctx.translate(seat.x, seat.y);
  ctx.scale(scale, scale);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(-1, -7, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-1, -3);
  ctx.lineTo(-1, 3);
  ctx.lineTo(5, 3);
  ctx.lineTo(8, 8);
  ctx.moveTo(-1, -1);
  ctx.lineTo(5, -1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-3, 4, 6, -Math.PI * 0.65, Math.PI * 0.25, true);
  ctx.stroke();
  ctx.restore();
}
