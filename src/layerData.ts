import type { MapOutline, SvgBackground } from './types.js';

function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Expected a layer object');
  }
}

function bounds(value: unknown): void {
  object(value);
  for (const field of ['x', 'y', 'width', 'height']) {
    const number = value[field];
    if (typeof number !== 'number' || !Number.isFinite(number)) {
      throw new TypeError('Layer bounds must contain finite coordinates and dimensions');
    }
    if ((field === 'width' || field === 'height') && number <= 0) {
      throw new TypeError('Layer bounds must have positive dimensions');
    }
  }
}

function opacity(value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError('Layer opacity must be between 0 and 1');
  }
}

export function validateBackground(value: unknown): asserts value is SvgBackground {
  object(value);
  bounds(value.bounds);
  opacity(value.opacity);
  if ((value.svg === undefined) === (value.url === undefined)) {
    throw new TypeError('SVG background requires exactly one of svg or url');
  }
  const source = value.svg ?? value.url;
  if (typeof source !== 'string' || !source.trim()) {
    throw new TypeError('SVG background source must be a non-empty string');
  }
}

export function validateOutlines(value: unknown): asserts value is readonly MapOutline[] {
  if (!Array.isArray(value)) throw new TypeError('Outlines must be an array');
  const ids = new Set<string>();
  for (const outline of value) {
    object(outline);
    for (const key of ['id', 'label', 'path'] as const) {
      if (typeof outline[key] !== 'string' || !outline[key].trim()) {
        throw new TypeError(`Outline ${key} must be a non-empty string`);
      }
    }
    const id = String(outline.id);
    if (ids.has(id)) throw new TypeError('Duplicate outline ID');
    ids.add(id);
    bounds(outline.bounds);
    opacity(outline.opacity);
    if (
      outline.transform !== undefined &&
      (!Array.isArray(outline.transform) ||
        outline.transform.length !== 6 ||
        outline.transform.some((value) => typeof value !== 'number' || !Number.isFinite(value)))
    )
      throw new TypeError('Outline transform must contain six finite numbers');
    if (outline.interactive !== undefined && typeof outline.interactive !== 'boolean')
      throw new TypeError('Outline interactive must be boolean');
    for (const key of ['fill', 'stroke']) {
      if (outline[key] !== undefined && typeof outline[key] !== 'string') {
        throw new TypeError(`Outline ${key} must be a color string`);
      }
    }
    if (
      outline.strokeWidth !== undefined &&
      (typeof outline.strokeWidth !== 'number' ||
        !Number.isFinite(outline.strokeWidth) ||
        outline.strokeWidth < 0)
    ) {
      throw new TypeError('Outline strokeWidth must be non-negative');
    }
    if (
      outline.fillRule !== undefined &&
      outline.fillRule !== 'nonzero' &&
      outline.fillRule !== 'evenodd'
    ) {
      throw new TypeError('Outline fillRule must be nonzero or evenodd');
    }
  }
}
