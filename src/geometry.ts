import KDBush from 'kdbush';
import type { Bounds, Point, Seat, SeatmapData } from './types.js';

export function getBounds(data: SeatmapData, radius: number): Bounds {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const extend = (x: number, y: number, width: number, height: number) => {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  };
  for (const seat of data.seats) extend(seat.x - radius, seat.y - radius, radius * 2, radius * 2);
  for (const shape of data.shapes ?? []) extend(shape.x, shape.y, shape.width, shape.height);
  if (data.background) {
    const { x, y, width, height } = data.background.bounds;
    extend(x, y, width, height);
  }
  for (const { bounds } of data.outlines ?? [])
    extend(bounds.x, bounds.y, bounds.width, bounds.height);
  for (const label of data.labels ?? []) {
    const size = label.size ?? 12;
    const width = label.text.length * size * 0.6;
    extend(label.x - width / 2, label.y - size / 2, width, size);
  }
  return Number.isFinite(left)
    ? { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
    : { x: 0, y: 0, width: 100, height: 100 };
}

export class Viewport {
  x = 0;
  y = 0;
  scale = 1;
  fitScale = 1;
  initialPadding?: number;
  maxFitScale?: number;
  minScale?: number;
  maxScale?: number;

  fit(bounds: Bounds, width: number, height: number): void {
    const padding = Math.min(40, width * 0.08, height * 0.08);
    this.fitScale = Math.max(
      0.00001,
      Math.min(
        Math.max(1, width - padding * 2) / bounds.width,
        Math.max(1, height - padding * 2) / bounds.height,
      ),
    );
    if (this.initialPadding !== undefined)
      this.fitScale = Math.min(
        this.maxFitScale ?? 1,
        Math.min(width / bounds.width, height / bounds.height) * this.initialPadding,
      );
    this.scale = this.fitScale;
    this.x =
      (width - bounds.width * this.scale) / 2 -
      (this.initialPadding === undefined ? bounds.x * this.scale : 0);
    this.y =
      (height - bounds.height * this.scale) / 2 -
      (this.initialPadding === undefined ? bounds.y * this.scale : 0);
  }

  toWorld(point: Point): Point {
    return { x: (point.x - this.x) / this.scale, y: (point.y - this.y) / this.scale };
  }

  focus(bounds: Bounds, width: number, height: number): void {
    const fitted = new Viewport();
    fitted.fit(bounds, width, height);
    this.scale = Math.min(
      this.maxScale ?? this.fitScale * 10,
      Math.max(this.minScale ?? this.fitScale * 0.6, fitted.scale),
    );
    this.x = width / 2 - (bounds.x + bounds.width / 2) * this.scale;
    this.y = height / 2 - (bounds.y + bounds.height / 2) * this.scale;
  }

  toScreen(point: Point): Point {
    return { x: point.x * this.scale + this.x, y: point.y * this.scale + this.y };
  }

  zoom(factor: number, anchor: Point): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const world = this.toWorld(anchor);
    this.scale = Math.min(
      this.maxScale ?? this.fitScale * 10,
      Math.max(this.minScale ?? this.fitScale * 0.6, this.scale * factor),
    );
    this.x = anchor.x - world.x * this.scale;
    this.y = anchor.y - world.y * this.scale;
  }
}

export class SeatIndex {
  private tree: KDBush;

  constructor(private seats: readonly Seat[]) {
    this.tree = new KDBush(seats.length);
    for (const seat of seats) this.tree.add(seat.x, seat.y);
    this.tree.finish();
  }

  query(bounds: Bounds): Seat[] {
    return this.tree
      .range(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height)
      .sort((a, b) => a - b)
      .map((index) => this.seats[index]!);
  }

  update(seats: readonly Seat[]): void {
    const unchanged =
      seats.length === this.seats.length &&
      seats.every((seat, i) => {
        const previous = this.seats[i]!;
        return seat.id === previous.id && seat.x === previous.x && seat.y === previous.y;
      });
    this.seats = seats;
    if (unchanged) return;
    this.tree = new KDBush(seats.length);
    for (const seat of seats) this.tree.add(seat.x, seat.y);
    this.tree.finish();
  }

  hit(point: Point, radius: number): Seat | undefined {
    let best: Seat | undefined;
    let distance = radius * radius;
    let topmost = -1;
    for (const index of this.tree.within(point.x, point.y, radius)) {
      const seat = this.seats[index]!;
      const next = (seat.x - point.x) ** 2 + (seat.y - point.y) ** 2;
      if (next < distance || (next === distance && index > topmost)) {
        best = seat;
        distance = next;
        topmost = index;
      }
    }
    return best;
  }
}
