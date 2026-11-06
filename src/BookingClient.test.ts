import { describe, expect, it, vi } from 'vitest';
import { BookingClient } from './BookingClient';
import type { SeatmapData } from './types';

const data: SeatmapData = {
  seats: [
    { id: 'A1', x: 0, y: 0, label: '1', category: 'standard' },
    { id: 'A2', x: 24, y: 0, label: '2', category: 'standard' },
    { id: 'A3', x: 48, y: 0, label: '3', status: 'unavailable' },
    { id: 1, x: 72, y: 0, label: '4' },
    { id: '1', x: 96, y: 0, label: '5' },
  ],
  categories: [{ id: 'standard', label: 'Standard', color: '#456', price: 1050 }],
};

describe('BookingClient', () => {
  it('tracks selection and integer minor-unit totals', () => {
    const client = new BookingClient({ data });
    client.select('A1');
    client.select('A2');
    expect(client.snapshot).toMatchObject({ seatIds: ['A1', 'A2'], count: 2, total: 2100 });
    client.toggle('A1');
    expect(client.snapshot).toMatchObject({ seatIds: ['A2'], count: 1, total: 1050 });
  });

  it('refuses unknown and unavailable seats without emitting changes', () => {
    const client = new BookingClient({ data });
    const listener = vi.fn();
    client.subscribe(listener);
    expect(client.select('missing')).toEqual({ ok: false, reason: 'unknown-seat' });
    expect(client.select('A3')).toEqual({ ok: false, reason: 'unavailable' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('enforces the limit while allowing deselection and idempotent selection', () => {
    const client = new BookingClient({ data, maxSelection: 1 });
    expect(client.select('A1')).toEqual({ ok: true });
    expect(client.select('A1')).toEqual({ ok: true });
    expect(client.select('A2')).toEqual({ ok: false, reason: 'limit' });
    client.toggle('A1');
    expect(client.select('A2')).toEqual({ ok: true });
  });

  it('drops seats that become unavailable and retains the other selections', () => {
    const client = new BookingClient({ data });
    client.select('A1');
    client.select('A2');
    client.setAvailability(new Map([['A1', 'unavailable']]));
    expect(client.snapshot.seatIds).toEqual(['A2']);
    expect(client.select('A1')).toEqual({ ok: false, reason: 'unavailable' });
    client.setAvailability(new Map([['A1', 'available']]));
    expect(client.select('A1')).toEqual({ ok: true });
  });

  it('drops removed seats and recalculates updated prices', () => {
    const client = new BookingClient({ data });
    client.select('A1');
    client.select('A2');
    client.setData({
      ...data,
      seats: data.seats.filter((seat) => seat.id !== 'A1'),
      categories: [{ id: 'standard', label: 'Standard', color: '#456', price: 2000 }],
    });
    expect(client.snapshot).toMatchObject({ seatIds: ['A2'], total: 2000 });
  });

  it('keeps string and numeric IDs distinct', () => {
    const client = new BookingClient({ data });
    client.select(1);
    client.select('1');
    expect(client.snapshot.seatIds).toEqual([1, '1']);
  });

  it('returns null instead of inventing a price for unpriced seats', () => {
    const client = new BookingClient({ data });
    client.select('A1');
    client.select(1);
    expect(client.snapshot.total).toBeNull();
    client.clear();
    expect(client.snapshot.total).toBe(0);
  });

  it('keeps input, output, and selection snapshots isolated', () => {
    const seats = [{ id: 'A1', x: 0, y: 0, label: '1' }];
    const client = new BookingClient({ data: { seats } });
    seats[0]!.label = 'changed';
    client.select('A1');
    const snapshot = client.snapshot;
    client.clear();
    expect(snapshot.seats[0]?.label).toBe('1');
    expect(snapshot.count).toBe(1);
    expect(Object.isFrozen(snapshot.seatIds)).toBe(true);
    expect(Object.isFrozen(client.data.seats[0])).toBe(true);
  });

  it('preserves valid state when replacement data is rejected', () => {
    const client = new BookingClient({ data });
    client.select('A1');
    expect(() => client.setData({ seats: [{ id: 'bad', x: NaN, y: 0, label: '1' }] })).toThrow();
    expect(client.snapshot.seatIds).toEqual(['A1']);
    expect(client.data.seats).toHaveLength(5);
  });

  it('notifies only changes and stops notifying unsubscribed listeners', () => {
    const client = new BookingClient({ data });
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);
    client.clear();
    client.deselect('unknown');
    client.select('A1');
    client.select('A1');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    client.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid selection limit %s', (maxSelection) => {
    expect(() => new BookingClient({ data, maxSelection })).toThrow(RangeError);
  });
});
