import { describe, expect, it } from 'vitest';
import { copyData, validateData } from './data';

const bounds = { x: -10, y: 20, width: 100, height: 80 };
const outline = { id: 'stalls', label: 'Stalls', path: 'M0 0H10V10Z', bounds };

describe('layer data', () => {
  it.each([
    { bounds },
    { bounds, svg: '', url: '/plan.svg' },
    { bounds, svg: ' ' },
    { bounds: { ...bounds, width: 0 }, svg: '<svg/>' },
    { bounds, svg: '<svg/>', opacity: 2 },
  ])('rejects invalid background %#', (background) => {
    expect(() => validateData({ seats: [], background })).toThrow(TypeError);
  });

  it.each([
    { outlines: [{ ...outline, path: '' }] },
    { outlines: [outline, outline] },
    { outlines: [{ ...outline, bounds: { ...bounds, x: Infinity } }] },
    { outlines: [{ ...outline, strokeWidth: -1 }] },
    { outlines: [{ ...outline, opacity: NaN }] },
    { outlines: [{ ...outline, fillRule: 'bad' }] },
  ])('rejects invalid outlines %#', ({ outlines }) => {
    expect(() => validateData({ seats: [], outlines })).toThrow(TypeError);
  });

  it('copies and freezes nested bounds for both layers', () => {
    const data = copyData({
      seats: [],
      background: { svg: '<svg/>', bounds },
      outlines: [outline],
    });
    expect(data.background?.bounds).not.toBe(bounds);
    expect(data.outlines?.[0]?.bounds).not.toBe(bounds);
    expect(Object.isFrozen(data.background?.bounds)).toBe(true);
    expect(Object.isFrozen(data.outlines?.[0]?.bounds)).toBe(true);
  });
});
