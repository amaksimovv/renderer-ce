import type {
  IAssignmentListDTO,
  IAvailabilityDTO,
  IPriceListDTO,
  ISchemaDTO,
} from './api-types.js';
import type { IBookingRendererSettings } from './settings.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode?: string,
  ) {
    super(`API request failed (${status})`);
    this.name = 'ApiError';
  }
}

export function deltas(values: number[]): number[] {
  let sum = 0;
  return values.map((value) => (sum += value));
}

export function unpackSchema(source: ISchemaDTO): ISchemaDTO {
  const schema = structuredClone(source);
  const plain = schema.plainSeats;
  if (plain) {
    const ids = deltas(plain.ids),
      x = deltas(plain.x),
      y = deltas(plain.y);
    const rows = deltas(plain.rowIds),
      sectors = deltas(plain.sectorIds);
    if ([x, y, rows, sectors, plain.names].some((values) => values.length !== ids.length))
      throw new Error('Invalid compressed seat data');
    schema.seats = ids.map((id, i) => ({
      id,
      x: x[i]!,
      y: y[i]!,
      rowId: rows[i]!,
      sectorId: sectors[i]!,
      name: plain.names[i]!,
    }));
    for (const entities of [schema.rows, schema.sectors]) {
      const absolute = deltas(entities.map((entity) => entity.id));
      entities.forEach((entity, i) => {
        entity.id = absolute[i]!;
      });
    }
    delete schema.plainSeats;
  }
  const flags = schema.configuration;
  if (flags?.accessible?.length || flags?.marked?.length) {
    const lookup = new Map(schema.seats.map((seat) => [seat.id, seat]));
    for (const [field, ids] of [
      ['isAccessible', flags.accessible],
      ['isMarked', flags.marked],
    ] as const) {
      for (const id of ids ?? []) {
        const target = lookup.get(id);
        if (target) target[field] = true;
      }
    }
  }
  return schema;
}

export function combinePrices(
  assignments: IAssignmentListDTO,
  availability: IAvailabilityDTO,
): IPriceListDTO {
  const ids = deltas(assignments.seatIds);
  const unavailable = new Set(deltas(availability.unavailableSeats));
  const properties = new Map(
    assignments.seatPropertyIndexes.map((index, i) => [index, assignments.seatProperties[i]]),
  );
  const seats: IPriceListDTO['seats'] = [];
  let index = 0;
  for (const [price, count] of assignments.seatPriceRuns) {
    if (!Number.isSafeInteger(count) || count < 0 || index + count > ids.length)
      throw new Error('Invalid price assignments');
    for (let j = 0; j < count; j++, index++) {
      const id = ids[index]!;
      if (!unavailable.has(id)) seats.push([id, price, properties.get(index)]);
    }
  }
  if (index !== ids.length) throw new Error('Incomplete price assignments');
  return {
    seats,
    prices: assignments.prices,
    orphanPrevention: availability.orphanPrevention,
    groupOfSeats: availability.groupOfSeats.map(([id, price, count]) => [
      id,
      price,
      count,
      assignments.groupOfSeats.find((item) => item[0] === id && item[1] === price)?.[2],
    ]),
  };
}

export class BookingApiClient {
  readonly baseUrl: string;
  constructor(private settings: IBookingRendererSettings) {
    const environment =
      settings.env === 'local'
        ? window.location.origin
        : settings.env === 'stage'
          ? 'https://booking.seatmap.dev'
          : 'https://booking.seatmap.pro';
    this.baseUrl = new URL(
      settings.baseUrl ?? `${environment}/api/public/v1.0/`,
      window.location.href,
    ).href.replace(/\/?$/, '/');
  }

  async request<T>(
    path: string,
    id: string,
    signal: AbortSignal,
    version = 1,
    text = false,
  ): Promise<T> {
    const base = version === 2 ? this.baseUrl.replace('/v1.0/', '/v2.0/') : this.baseUrl;
    const url = new URL(path, base);
    url.searchParams.set('id', id);
    url.searchParams.set('publicKey', this.settings.publicKey ?? '');
    if (path === 'event/') {
      url.searchParams.set('disableOriginal', 'true');
      url.searchParams.set('forceSvg', 'true');
    }
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(
      () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
      this.settings.requestTimeoutMs ?? 30000,
    );
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) {
        const error: unknown = await response.json().catch(() => undefined);
        const code =
          error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code
            : undefined;
        throw new ApiError(response.status, code);
      }
      return (text ? await response.text() : await response.json()) as T;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }

  async fetchSchemaForEvent(id: string, signal: AbortSignal): Promise<ISchemaDTO> {
    const schema = unpackSchema(await this.request<ISchemaDTO>('event/', id, signal));
    if (schema.background.svgLink)
      schema.background.svgLink = new URL(
        schema.background.svgLink,
        new URL('/', this.baseUrl),
      ).href;
    return schema;
  }

  async fetchPricesForEvent(id: string, signal: AbortSignal): Promise<IPriceListDTO> {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const [assignments, availability] = await Promise.all([
          this.request<IAssignmentListDTO>('event/assignments/', id, signal, 2),
          this.request<IAvailabilityDTO>('event/availability/', id, signal, 2),
        ]);
        if (assignments.version === availability.version)
          return combinePrices(assignments, availability);
      }
      throw new Error('Event prices changed while loading; reload the event');
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) throw error;
      return this.request<IPriceListDTO>('event/prices/', id, signal);
    }
  }

  fetchRowsSvgForEvent(id: string, signal: AbortSignal): Promise<string> {
    return this.request('event/schema/rows/', id, signal, 1, true);
  }
}
