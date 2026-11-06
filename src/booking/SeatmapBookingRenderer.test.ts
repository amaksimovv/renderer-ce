import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SeatmapBookingRenderer as Renderer } from './SeatmapBookingRenderer';
import type { ISchemaDTO, IPriceListDTO } from './api-types';
import { combinePrices, unpackSchema, BookingApiClient, ApiError } from './ApiClient';
import type { IBookingRendererSettings } from './settings';
import type { IRenderer } from './IRenderer';

class SeatmapBookingRenderer extends Renderer {
  async setData(schema: ISchemaDTO, prices: IPriceListDTO): Promise<void> {
    this.revision++;
    this.installSchema(unpackSchema(schema));
    this.installPrices(prices);
    await Promise.resolve();
  }
}

const schema: ISchemaDTO = {
  seats: [1, 2, 3, 4].map((id) => ({
    id,
    x: id * 24,
    y: 10,
    rowId: 10,
    sectorId: 20,
    name: String(id),
  })),
  rows: [{ id: 10, rowNumber: 1, sectorId: 20, name: 'A', seatName: 'Seat' }],
  sectors: [
    { id: 20, name: 'Stalls', isGa: false },
    { id: 21, name: 'Floor', isGa: true },
  ],
  background: { viewBox: { x: 0, y: 0, width: 200, height: 100 } },
};
const prices: IPriceListDTO = {
  seats: [
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  prices: [{ id: 1, name: '85.50' }],
  groupOfSeats: [[21, 1, 10]],
  orphanPrevention: false,
};
let host: HTMLDivElement;
let renderer: SeatmapBookingRenderer;
const create = (settings: Partial<IBookingRendererSettings> = {}) =>
  (renderer = new SeatmapBookingRenderer(host, {
    publicKey: 'test',
    loader: { enabled: false },
    ...settings,
  }));
const key = async (value: string) => {
  host
    .querySelector('[role=listbox]')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('Path2D', class {});
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  renderer?.destroy();
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('booking renderer contract', () => {
  it('loads JSON without credentials or requests, preserves input and restores a cart', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const source = structuredClone(schema);
    const pricing = structuredClone(prices);
    const events: string[] = [];
    create({
      publicKey: undefined,
      onSchemaDataLoaded: () => {
        events.push(`schema:${renderer.getPrices().length}`);
        renderer.initCart({ seats: [{ id: 2, key: '', price: 85.5 }], ga: [] });
      },
    });
    renderer.getDataManager().on('dataLoaded', () => events.push('ready'));
    await renderer.loadData(source, pricing);
    expect(events).toEqual(['schema:0', 'ready']);
    expect(renderer.getCart().seats).toMatchObject([{ id: 2, price: 85.5 }]);
    expect(renderer.getPrices()).toMatchObject([{ name: '85.50' }]);
    expect(fetch).not.toHaveBeenCalled();
    expect(source).toEqual(schema);
    expect(pricing).toEqual(prices);
  });
  it('replaces previous JSON data and clears the cart', async () => {
    create({ publicKey: undefined });
    await renderer.loadData(schema, prices);
    expect(renderer.addSeatsToCart([{ id: 2, key: '' }]).applied).toBe(true);
    const replacement = { ...schema, seats: schema.seats.filter((seat) => seat.id === 4) };
    await renderer.loadData(replacement, { seats: [], prices: [], groupOfSeats: [] });
    expect(renderer.getCart().seats).toHaveLength(0);
    expect(renderer.getPrices()).toHaveLength(0);
    expect(renderer.getSeats()).toMatchObject([{ id: 4 }]);
    renderer.destroy();
    await expect(renderer.loadData(schema, prices)).rejects.toThrow('destroyed');
  });
  it('keeps JSON data when an older event response arrives', async () => {
    let release!: (value: ISchemaDTO) => void;
    vi.spyOn(BookingApiClient.prototype, 'fetchSchemaForEvent').mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const api = BookingApiClient.prototype;
    vi.spyOn(api, 'fetchRowsSvgForEvent').mockResolvedValue('');
    vi.spyOn(api, 'fetchPricesForEvent').mockResolvedValue(prices);
    create();
    const inFlight = renderer.loadEvent('old');
    const local = { ...schema, seats: [schema.seats[3]!] };
    await renderer.loadData(local, prices);
    release({ ...schema, seats: [] });
    await inFlight;
    expect(renderer.getSeats()).toMatchObject([{ id: 4 }]);
  });
  it('implements IRenderer, repairs keys, preserves decimal prices and previous cart snapshots', async () => {
    const onCartChange = vi.fn();
    create({ onCartChange });
    await renderer.setData(schema, prices);
    const contract: IRenderer = renderer;
    expect(contract.addSeatsToCart([{ key: 'Stalls;;1;;1' }])).toEqual({
      applied: true,
      orphaned: [],
      remedy: null,
    });
    expect(contract.getCart()).toEqual({
      seats: [{ id: 1, key: 'Stalls;;1;;1', price: 85.5, special: undefined }],
      ga: [],
    });
    const snapshot = contract.getCart();
    snapshot.seats.length = 0;
    expect(contract.getCart().seats).toHaveLength(1);
    expect(onCartChange).not.toHaveBeenCalled();
    expect(renderer.seatKeysToIds(['Stalls;;1;;1', 'missing'])).toEqual([1]);
    expect(renderer.addSeatsToCart([{ id: 4, key: '' }]).applied).toBe(true);
    expect(renderer.getCart().seats).toHaveLength(2);
    renderer.removeSeatsFromCartByKeys(['Stalls;;1;;1']);
    expect(renderer.getCart().seats.map((seat) => seat.id)).toEqual([4]);
  });
  it('honors asynchronous select/deselect vetoes and never invokes them for programmatic changes', async () => {
    const onSeatSelect = vi.fn().mockResolvedValue(false),
      onSeatDeselect = vi.fn().mockResolvedValue(false);
    create({ onSeatSelect, onSeatDeselect });
    await renderer.setData(schema, prices);
    await key('Enter');
    expect(renderer.getCart().seats).toHaveLength(0);
    expect(onSeatSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        key: 'Stalls;;1;;1',
        ax: 24,
        ay: 10,
        seatName: '1',
        sectionName: 'Stalls',
        rowNumber: 1,
      }),
    );
    onSeatSelect.mockResolvedValue(true);
    await key('Enter');
    expect(renderer.getCart().seats).toHaveLength(1);
    await key('Enter');
    expect(renderer.getCart().seats).toHaveLength(1);
    renderer.clearCart();
    expect(onSeatDeselect).toHaveBeenCalledTimes(1);
  });
  it('accepts concurrent seat callbacks and cancels pending selection when cart is cleared', async () => {
    const pending = new Map<number, (accepted: boolean) => void>();
    create({
      onSeatSelect: (seat) => new Promise<boolean>((resolve) => pending.set(seat.id!, resolve)),
    });
    await renderer.setData(schema, prices);
    await key('Enter');
    await key('ArrowRight');
    await key('Enter');
    pending.get(1)!(true);
    await Promise.resolve();
    pending.get(2)!(true);
    await Promise.resolve();
    expect(renderer.getCart().seats.map((seat) => seat.id)).toEqual([1, 2]);
    await key('ArrowRight');
    await key('Enter');
    renderer.clearCart();
    pending.get(3)!(true);
    await Promise.resolve();
    expect(renderer.getCart().seats).toEqual([]);
  });
  it('discards callbacks resolved after an event change or destroy', async () => {
    let resolve: (accepted: boolean) => void = () => {};
    create({
      onSeatSelect: () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    });
    await renderer.setData(schema, prices);
    await key('Enter');
    await renderer.setData(schema, prices);
    resolve(true);
    await Promise.resolve();
    expect(renderer.getCart().seats).toHaveLength(0);
  });
  it('keeps GA, seat locks, category reset and filters consistent', async () => {
    create({ selectionLimit: 6 });
    await renderer.setData(schema, prices);
    renderer.addGaToCart({ key: 'Floor', count: 2, price: 35 });
    renderer.addGaToCart({ sectorId: 21, key: 'Floor', count: 1 });
    expect(renderer.getCart().ga).toEqual([{ sectorId: 21, key: 'Floor', count: 3, price: 35 }]);
    renderer.removeGaFromCart({ sectorId: 21, price: 55 });
    expect(renderer.getCart().ga).toHaveLength(1);
    renderer.removeGaFromCart({ sectorId: 21 });
    expect(renderer.getCart().ga).toHaveLength(0);
    renderer.addSeatsToCart([{ id: 1, key: '' }]);
    renderer.disableSeatsByKeys(['Stalls;;1;;1']);
    expect(renderer.getCart().seats).toHaveLength(0);
    renderer.enableSeatsByIds([1]);
    renderer.filterSeatsByKeys(['Stalls;;1;;1']);
    expect(renderer.getDataManager().getSeatMetadata(2)?.filtered).toBe(true);
    renderer.removeFilter();
    renderer.setSeatsCategory([1], 'vip', '#ff0000');
    expect(renderer.getCategoryColor('vip')).toBe('#ff0000');
    renderer.resetCategories();
    expect(renderer.getDataManager().getSeatMetadata(1)?.priceId).toBe(1);
  });
  it('prevents new orphan seats and returns a remedy without partial mutation', async () => {
    create({ orphanPrevention: true });
    await renderer.setData(schema, prices);
    expect(renderer.addSeatsToCart([{ id: 2, key: '' }])).toMatchObject({
      applied: false,
      orphaned: [1, 3],
      remedy: { select: [1, 3] },
    });
    expect(renderer.getCart().seats).toEqual([]);
    expect(renderer.addSeatsToCart([{ id: 1, key: '' }]).applied).toBe(true);
  });
  it('loads existing Booking endpoints and preserves onSchemaDataLoaded initialization', async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = new URL(String(input));
        requests.push(url.pathname);
        expect(url.searchParams.get('publicKey')).toBe('test');
        if (url.pathname.includes('/v2.0/')) return new Response('{}', { status: 404 });
        return new Response(
          url.pathname.endsWith('/prices/')
            ? JSON.stringify(prices)
            : url.pathname.endsWith('/rows/')
              ? '<svg/>'
              : JSON.stringify(schema),
        );
      }),
    );
    create({
      baseUrl: 'https://example.com/api/public/v1.0/',
      onSchemaDataLoaded: () => renderer.initCart({ seats: [{ id: 1, key: '' }], ga: [] }),
    });
    await renderer.loadEvent('event-guid');
    expect(requests).toContain('/api/public/v1.0/event/');
    expect(requests).toContain('/api/public/v1.0/event/schema/rows/');
    expect(renderer.getCart().seats).toHaveLength(1);
  });
  it('propagates API errors and does not fall back on authentication errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 403 })),
    );
    const api = new BookingApiClient({
      publicKey: 'test',
      baseUrl: 'https://example.com/api/public/v1.0/',
    });
    await expect(
      api.fetchPricesForEvent('id', new AbortController().signal),
    ).rejects.toBeInstanceOf(ApiError);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
  });

  it('fires the schema callback before slow prices and restores held seats without applying the selection limit', async () => {
    vi.spyOn(BookingApiClient.prototype, 'fetchSchemaForEvent').mockResolvedValue(schema);
    vi.spyOn(BookingApiClient.prototype, 'fetchRowsSvgForEvent').mockResolvedValue('');
    let release: (value: IPriceListDTO) => void = () => {};
    vi.spyOn(BookingApiClient.prototype, 'fetchPricesForEvent').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const loaded = vi.fn(() => {
      expect(renderer.getPrices()).toEqual([]);
      expect(
        renderer.initCart({
          seats: [
            { id: 1, key: '', price: 85.5 },
            { id: 4, key: '', price: 85.5 },
          ],
          ga: [],
        }).applied,
      ).toBe(true);
    });
    create({ selectionLimit: 1, onSchemaDataLoaded: loaded });
    const loading = renderer.loadEvent('slow-prices');
    await vi.waitFor(() => expect(loaded).toHaveBeenCalledOnce());
    release(prices);
    await loading;
    expect(renderer.getCart().seats.map((seat) => seat.id)).toEqual([1, 4]);
  });
  it('requires a public key only for API loading and reports unavailable 3D explicitly', async () => {
    create({ publicKey: undefined });
    await expect(renderer.loadEvent('event')).rejects.toThrow('Public key is undefined');
    renderer.destroy();
    expect(() => create({ enable3DView: true })).toThrow('3D');
    expect(host.children).toHaveLength(0);
  });
});

describe('Booking API wire formats', () => {
  it('decodes coordinates, row and section deltas without modifying input', () => {
    const wire: ISchemaDTO = {
      ...schema,
      plainSeats: {
        ids: [100, 1],
        x: [5, 24],
        y: [7, -2],
        rowIds: [10, 0],
        sectorIds: [20, 0],
        names: ['1', '2'],
      },
      rows: [schema.rows[0]!, { ...schema.rows[0]!, id: 1 }],
      sectors: [schema.sectors[0]!, { ...schema.sectors[1]!, id: 1 }],
      configuration: { accessible: [101], marked: [100] },
    };
    const result = unpackSchema(wire);
    expect(result.seats[1]).toMatchObject({
      id: 101,
      x: 29,
      y: 5,
      rowId: 10,
      sectorId: 20,
      isAccessible: true,
    });
    expect(result.rows[1]?.id).toBe(11);
    expect(result.sectors[1]?.id).toBe(21);
    expect(wire.plainSeats).toBeDefined();
  });
  it('combines v2 runs, special properties and live availability', () => {
    const result = combinePrices(
      {
        seatIds: [10, 1, 2],
        seatPriceRuns: [
          [1, 2],
          [2, 1],
        ],
        seatPropertyIndexes: [2],
        seatProperties: [{ s1: 7 }],
        groupOfSeats: [[21, 1]],
        prices: prices.prices,
      },
      { unavailableSeats: [11], groupOfSeats: [[21, 1, 8]], orphanPrevention: true },
    );
    expect(result.seats).toEqual([
      [10, 1, undefined],
      [13, 2, { s1: 7 }],
    ]);
    expect(result.groupOfSeats).toEqual([[21, 1, 8, undefined]]);
  });
});
