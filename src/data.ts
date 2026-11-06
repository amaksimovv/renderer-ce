import type { MapOutline } from './types.js';
import type { SeatmapData } from './types.js';
import { validateBackground, validateOutlines } from './layerData.js';

function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Expected an object in seatmap data');
  }
}

function finite(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Seatmap coordinates and dimensions must be finite numbers');
  }
}

function text(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new TypeError('Expected text in seatmap data');
}

function array(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Expected an array in seatmap data');
}

export function validateData(value: unknown): asserts value is SeatmapData {
  record(value);
  if (value.background !== undefined) validateBackground(value.background);
  if (value.outlines !== undefined) validateOutlines(value.outlines);
  array(value.seats);
  const ids = new Set<string | number>();
  const categories = new Set<string>();
  if (value.categories !== undefined) {
    array(value.categories);
    for (const category of value.categories) {
      record(category);
      text(category.id);
      text(category.label);
      text(category.color);
      if (categories.has(category.id)) throw new TypeError('Duplicate category ID');
      categories.add(category.id);
      if (category.price !== undefined) {
        finite(category.price);
        if (!Number.isSafeInteger(category.price) || category.price < 0) {
          throw new TypeError('Prices must be non-negative safe integers in minor currency units');
        }
      }
    }
  }
  for (const seat of value.seats) {
    record(seat);
    if (typeof seat.id !== 'string' && typeof seat.id !== 'number') {
      throw new TypeError('Seat IDs must be strings or numbers');
    }
    if (typeof seat.id === 'number' && !Number.isSafeInteger(seat.id)) {
      throw new TypeError('Numeric seat IDs must be safe integers');
    }
    if (ids.has(seat.id)) throw new TypeError('Duplicate seat ID');
    ids.add(seat.id);
    finite(seat.x);
    finite(seat.y);
    text(seat.label);
    for (const field of ['row', 'section', 'category'] as const) {
      if (seat[field] !== undefined) text(seat[field]);
    }
    if (seat.category !== undefined && !categories.has(String(seat.category))) {
      throw new TypeError('Seat references an unknown category');
    }
    if (seat.status !== undefined && !['available', 'unavailable'].includes(String(seat.status))) {
      throw new TypeError('Unknown seat status');
    }
    if (seat.accessible !== undefined && typeof seat.accessible !== 'boolean') {
      throw new TypeError('Seat accessible flag must be a boolean');
    }
  }
  for (const key of ['labels', 'shapes'] as const) {
    if (value[key] === undefined) continue;
    array(value[key]);
    for (const item of value[key]) {
      record(item);
      finite(item.x);
      finite(item.y);
      if (key === 'labels') {
        text(item.text);
        if (item.size !== undefined) {
          finite(item.size);
          if (item.size <= 0) throw new TypeError('Label size must be positive');
        }
        if (item.color !== undefined) text(item.color);
      } else {
        finite(item.width);
        finite(item.height);
        if (item.width <= 0 || item.height <= 0) throw new TypeError('Shape size must be positive');
        if (item.fill !== undefined) text(item.fill);
        if (item.label !== undefined) text(item.label);
      }
    }
  }
}

export function copyData(data: SeatmapData): SeatmapData {
  validateData(data);
  return Object.freeze({
    seats: Object.freeze(data.seats.map((seat) => Object.freeze({ ...seat }))),
    categories: Object.freeze(
      (data.categories ?? []).map((category) => Object.freeze({ ...category })),
    ),
    labels: Object.freeze((data.labels ?? []).map((label) => Object.freeze({ ...label }))),
    shapes: Object.freeze((data.shapes ?? []).map((shape) => Object.freeze({ ...shape }))),
    background:
      data.background === undefined
        ? undefined
        : Object.freeze({
            ...data.background,
            bounds: Object.freeze({ ...data.background.bounds }),
          }),
    outlines: Object.freeze(
      (data.outlines ?? []).map((outline) =>
        Object.freeze({
          ...outline,
          bounds: Object.freeze({ ...outline.bounds }),
          transform: outline.transform
            ? (Object.freeze([...outline.transform]) as MapOutline['transform'])
            : undefined,
        }),
      ),
    ),
  });
}

export async function loadSeatmap(url: string | URL, signal?: AbortSignal): Promise<SeatmapData> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Unable to load seatmap (HTTP ${response.status})`);
  const data: unknown = await response.json();
  validateData(data);
  return copyData(data);
}
