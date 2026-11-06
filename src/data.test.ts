import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSeatmap, validateData } from './data';

const seat = { id: 'A1', x: 0, y: 0, label: '1' };
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('seatmap data', () => {
  it.each([
    null,
    { seats: {} },
    { seats: [seat, seat] },
    { seats: [{ ...seat, x: Infinity }] },
    { seats: [{ ...seat, id: NaN }] },
    { seats: [{ ...seat, status: 'sold' }] },
    { seats: [{ ...seat, category: 'missing' }] },
    { seats: [{ ...seat, accessible: 'true' }] },
    { seats: [seat], categories: [{ id: 'a', label: 'A', color: '#123', price: 1.05 }] },
    { seats: [seat], shapes: [{ x: 0, y: 0, width: -1, height: 10 }] },
    { seats: [seat], labels: [{ x: 0, y: 0, text: 'Stage', size: 0 }] },
  ])('rejects malformed data %#', (data) => {
    expect(() => validateData(data)).toThrow(TypeError);
  });

  it('loads and validates custom backend JSON with cancellation', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ seats: [seat] })));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    expect((await loadSeatmap('/seatmap.json', signal)).seats).toEqual([seat]);
    expect(fetcher).toHaveBeenCalledWith('/seatmap.json', { signal });
  });

  it('reports HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 })),
    );
    await expect(loadSeatmap('/seatmap.json')).rejects.toThrow('HTTP 503');
  });

  it('rejects malformed backend data before it reaches a renderer', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{"seats":[{}]}')));
    await expect(loadSeatmap('/seatmap.json')).rejects.toThrow(TypeError);
  });

  it('propagates network errors and cancellation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Cancelled', 'AbortError')),
    );
    await expect(loadSeatmap('/seatmap.json')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
