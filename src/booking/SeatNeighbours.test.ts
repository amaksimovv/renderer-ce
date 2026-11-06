import { describe, expect, it } from 'vitest';
import { SeatNeighbours } from './SeatNeighbours';
import type { ISeat } from './models';

const vertical = (positions: number[]) =>
  new Map<number, ISeat>(
    positions.map((y, i) => [
      i + 1,
      {
        id: i + 1,
        name: String(i + 1),
        x: 8,
        y,
        rowId: 20,
        sectorId: 44,
        priceId: 1,
      },
    ]),
  );

describe('row neighbours', () => {
  it('treats an aisle as a boundary and reports only newly isolated seats', () => {
    const layout = new SeatNeighbours(vertical([0, 10, 20, 100, 110, 120, 130]));
    expect(layout.check(true, [3, 5], [], () => false)).toEqual({
      applied: false,
      orphaned: [4],
      remedy: { select: [4], deselect: [] },
    });
    expect(layout.check(true, [3, 5], [], (id) => id === 4).remedy).toBeNull();
  });
  it('reuses row geometry but reads current availability on every operation', () => {
    const seats = vertical([10, 20, 30, 40, 50]);
    const layout = new SeatNeighbours(seats);
    expect(layout.check(true, [4], [], () => false).orphaned).toEqual([5]);
    seats.get(5)!.locked = true;
    expect(layout.check(true, [4], [], () => false).applied).toBe(true);
  });
  it('suggests releasing a neighbour without splitting the remaining cart', () => {
    const layout = new SeatNeighbours(vertical([10, 20, 30, 40, 50, 60]));
    expect(layout.check(false, [3], [1, 2, 3, 4], () => false)).toEqual({
      applied: false,
      orphaned: [3],
      remedy: { select: [], deselect: [4] },
    });
  });
});
