import { expect, it, vi } from 'vitest';
import { seatStyle } from './seatStyles';
import type { ISeat, IRendererSettings, IBeforeSeatDrawEvent } from './models';
import type { Context } from './settings';

const seat: ISeat = { id: 1, x: 20, y: 20, name: '12', rowId: 1, sectorId: 1 };
const base = { size: 16, color: '#2196f3' };
const context: Context = {
  seats: [seat],
  seatsById: { 1: seat },
  rowsById: {},
  sectionsById: {},
  settings: {},
  scale: 1,
  translate: { x: 0, y: 0 },
  getCart: () => ({ seats: [], ga: [] }),
};

it('uses booking sizes and preserves price colors for hover and selection', () => {
  expect(seatStyle({}, seat, 'default', base, context)).toEqual(base);
  expect(seatStyle({}, seat, 'unavailable', base, context)).toMatchObject({
    size: 6,
    color: '#bbb',
  });
  expect(seatStyle({}, seat, 'hovered', base, context)).toMatchObject({
    size: 38,
    color: base.color,
    seatName: { font: '18px Arial, sans-serif', color: '#fff' },
  });
  expect(seatStyle({}, seat, 'selected', base, context)).toMatchObject({
    size: 42,
    color: base.color,
    shadow: { blur: 20, color: 'rgba(0, 0, 0, 0.3)' },
  });
  expect(seatStyle({}, { ...seat, isAccessible: true }, 'default', base, context).size).toBe(26);
});

it('keeps custom styles and the final drawing callback authoritative', () => {
  const onBeforeSeatDraw = vi.fn(({ style }: IBeforeSeatDrawEvent) => ({
    ...style,
    color: '#abcdef',
  }));
  const settings: IRendererSettings = {
    theme: {
      seatStyles: {
        hovered: { size: 32, color: '#ff0000', accessible: { size: 40, color: '#00ff00' } },
        vip: { tint: '#123456' },
      },
    },
    onBeforeSeatDraw,
  };
  const style = seatStyle(
    settings,
    { ...seat, isAccessible: true, customState: 'vip' },
    'hovered',
    base,
    context,
  );
  expect(onBeforeSeatDraw).toHaveBeenCalledWith(
    expect.objectContaining({
      style: expect.objectContaining({ size: 40, color: '#123456' }),
    }),
  );
  expect(style).toMatchObject({ size: 40, color: '#abcdef' });
  expect(base).toEqual({ size: 16, color: '#2196f3' });
});
