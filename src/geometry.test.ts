import { describe, expect, it } from 'vitest';
import { getBounds, SeatIndex, Viewport } from './geometry';

describe('viewport and hit testing', () => {
  it('fits background and outline bounds including nonzero origins', () => {
    expect(
      getBounds(
        {
          seats: [],
          background: { svg: '<svg/>', bounds: { x: -200, y: 50, width: 400, height: 300 } },
          outlines: [
            {
              id: 'a',
              label: 'A',
              path: 'M0 0H20V20Z',
              bounds: { x: 100, y: -100, width: 300, height: 150 },
            },
          ],
        },
        8,
      ),
    ).toEqual({ x: -200, y: -100, width: 600, height: 450 });
  });

  it('focuses a section without changing the full-map zoom limits', () => {
    const view = new Viewport();
    view.fit({ x: 0, y: 0, width: 1000, height: 1000 }, 500, 500);
    const fitScale = view.fitScale;
    view.focus({ x: 100, y: 200, width: 100, height: 200 }, 500, 500);
    expect(view.fitScale).toBe(fitScale);
    expect(view.scale).toBeGreaterThan(fitScale);
    expect(view.toScreen({ x: 150, y: 300 })).toEqual({ x: 250, y: 250 });
  });
  it('fits negative coordinates including seats, stage, and labels', () => {
    const bounds = getBounds(
      {
        seats: [{ id: 'a', x: -50, y: -30, label: '1' }],
        shapes: [{ x: 0, y: 0, width: 200, height: 40 }],
        labels: [{ x: 0, y: -100, text: 'Stage' }],
      },
      8,
    );
    const view = new Viewport();
    view.fit(bounds, 800, 400);
    expect(view.toScreen(bounds).x).toBeGreaterThan(0);
    expect(view.toScreen(bounds).y).toBeGreaterThan(0);
    expect(
      view.toScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }).x,
    ).toBeLessThan(800);
  });

  it('keeps the world point under the cursor fixed through zoom', () => {
    const view = new Viewport();
    view.fit({ x: -200, y: 100, width: 800, height: 500 }, 720, 480);
    const cursor = { x: 153, y: 284 };
    const before = view.toWorld(cursor);
    view.zoom(2, cursor);
    expect(view.toWorld(cursor).x).toBeCloseTo(before.x);
    expect(view.toWorld(cursor).y).toBeCloseTo(before.y);
  });

  it('clamps zoom and ignores invalid factors', () => {
    const view = new Viewport();
    view.zoom(1000, { x: 0, y: 0 });
    expect(view.scale).toBe(10);
    view.zoom(0.000001, { x: 0, y: 0 });
    expect(view.scale).toBe(0.6);
    view.zoom(NaN, { x: 0, y: 0 });
    expect(view.scale).toBe(0.6);
  });

  it('handles an empty or initially hidden container', () => {
    const view = new Viewport();
    view.fit(getBounds({ seats: [] }, 8), 0, 0);
    expect(Number.isFinite(view.scale)).toBe(true);
    expect(view.scale).toBeGreaterThan(0);
  });

  it('finds the nearest seat including negative coordinates', () => {
    const index = new SeatIndex([
      { id: 'a', x: -2, y: -2, label: '1' },
      { id: 'b', x: 5, y: 5, label: '2' },
    ]);
    expect(index.hit({ x: 0, y: 0 }, 8)?.id).toBe('a');
    expect(index.hit({ x: 6, y: 6 }, 8)?.id).toBe('b');
    expect(index.hit({ x: 30, y: 30 }, 8)).toBeUndefined();
  });
});

it('queries fractional coordinates with inclusive bounds and stable paint order', () => {
  const seats = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    label: String(i),
    x: (i % 37) - 15.5,
    y: Math.floor(i / 37) - 8.25,
  }));
  const index = new SeatIndex(seats);
  const bounds = { x: -10.5, y: -5.25, width: 20, height: 10 };
  expect(index.query(bounds)).toEqual(
    seats.filter(
      (s) =>
        s.x >= bounds.x &&
        s.y >= bounds.y &&
        s.x <= bounds.x + bounds.width &&
        s.y <= bounds.y + bounds.height,
    ),
  );
  expect(new SeatIndex([]).query(bounds)).toEqual([]);
});

it('chooses the last painted seat for overlapping points', () => {
  const index = new SeatIndex([
    { id: 1, x: 0, y: 0, label: '1' },
    { id: 2, x: 0, y: 0, label: '2' },
  ]);
  expect(index.hit({ x: 0, y: 0 }, 8)?.id).toBe(2);
});

it('updates seat metadata without stale references and rebuilds for new geometry', () => {
  const index = new SeatIndex([{ id: 1, x: 1.5, y: 2.5, label: '1' }]);
  index.update([{ id: 1, x: 1.5, y: 2.5, label: 'sold', status: 'unavailable' }]);
  expect(index.hit({ x: 1.5, y: 2.5 }, 1)?.status).toBe('unavailable');
  index.update([{ id: 2, x: 100, y: 100, label: '2' }]);
  expect(index.hit({ x: 1.5, y: 2.5 }, 1)).toBeUndefined();
  expect(index.hit({ x: 100, y: 100 }, 1)?.id).toBe(2);
});
