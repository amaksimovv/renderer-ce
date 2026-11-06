import { copyData } from './data.js';
import type {
  BookingOptions,
  BookingSnapshot,
  Seat,
  SeatId,
  SeatmapData,
  SeatStatus,
  SelectionResult,
} from './types.js';

export class BookingClient {
  private currentData: SeatmapData;
  private seatIndex: Map<SeatId, Seat>;
  private selected = new Set<SeatId>();
  private listeners = new Set<(snapshot: BookingSnapshot) => void>();
  readonly maxSelection: number;

  constructor(options: BookingOptions) {
    this.maxSelection = options.maxSelection ?? 8;
    if (!Number.isSafeInteger(this.maxSelection) || this.maxSelection < 1) {
      throw new RangeError('maxSelection must be a positive safe integer');
    }
    this.currentData = copyData(options.data);
    this.seatIndex = new Map(this.currentData.seats.map((seat) => [seat.id, seat]));
  }

  get data(): SeatmapData {
    return this.currentData;
  }

  get snapshot(): BookingSnapshot {
    const seats = [...this.selected].flatMap((id) => {
      const seat = this.seatIndex.get(id);
      return seat ? [seat] : [];
    });
    const categories = new Map(this.data.categories?.map((category) => [category.id, category]));
    let total: number | null = 0;
    for (const seat of seats) {
      const price = seat.category === undefined ? undefined : categories.get(seat.category)?.price;
      if (price === undefined || total === null || !Number.isSafeInteger(total + price))
        total = null;
      else total += price;
    }
    return Object.freeze({
      seats: Object.freeze(seats),
      seatIds: Object.freeze(seats.map((seat) => seat.id)),
      total,
      count: seats.length,
    });
  }

  isSelected(id: SeatId): boolean {
    return this.selected.has(id);
  }

  select(id: SeatId): SelectionResult {
    const seat = this.seatIndex.get(id);
    if (!seat) return { ok: false, reason: 'unknown-seat' };
    if (seat.status === 'unavailable') return { ok: false, reason: 'unavailable' };
    if (this.selected.has(id)) return { ok: true };
    if (this.selected.size >= this.maxSelection) return { ok: false, reason: 'limit' };
    this.selected.add(id);
    this.emit();
    return { ok: true };
  }

  deselect(id: SeatId): void {
    if (this.selected.delete(id)) this.emit();
  }

  toggle(id: SeatId): SelectionResult {
    if (!this.selected.has(id)) return this.select(id);
    this.deselect(id);
    return { ok: true };
  }

  clear(): void {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.emit();
  }

  setData(data: SeatmapData): void {
    const next = copyData(data);
    this.currentData = next;
    this.seatIndex = new Map(next.seats.map((seat) => [seat.id, seat]));
    this.selected = new Set(
      [...this.selected].filter((id) => {
        const seat = this.seatIndex.get(id);
        return seat !== undefined && seat.status !== 'unavailable';
      }),
    );
    this.emit();
  }

  setAvailability(updates: ReadonlyMap<SeatId, SeatStatus>): void {
    this.setData({
      ...this.data,
      seats: this.data.seats.map((seat) => ({
        ...seat,
        status: updates.get(seat.id) ?? seat.status,
      })),
    });
  }

  subscribe(listener: (snapshot: BookingSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
