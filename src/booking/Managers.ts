import { MetadataCache } from './MetadataCache.js';
import type { ISeatMetadata, ISectionMetadata, IEntityStates } from './models.js';

type Listener = (entityId?: number) => void;
export type DataEventType = 'dataLoaded' | 'sectionsChanged' | 'seatsChanged' | 'dataInvalidated';
export class DataManager {
  private listeners = new Map<DataEventType, Set<Listener>>();
  private sectionCache: MetadataCache<ISectionMetadata>;
  private seatCache: MetadataCache<ISeatMetadata>;
  constructor(sections: () => ISectionMetadata[], seats: () => ISeatMetadata[]) {
    this.sectionCache = new MetadataCache(sections);
    this.seatCache = new MetadataCache(seats);
  }
  on(event: DataEventType, callback: Listener): void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(callback);
    this.listeners.set(event, listeners);
  }
  off(event: DataEventType, callback: Listener): void {
    this.listeners.get(event)?.delete(callback);
  }
  private emit(event: DataEventType, id?: number): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(id);
      } catch (error) {
        console.error(`Error in ${event} event handler:`, error);
      }
    });
  }
  getSectionMetadata(id: number): ISectionMetadata | null {
    return this.sectionCache.get(id);
  }
  getAllSectionMetadata(): ISectionMetadata[] {
    return this.sectionCache.all();
  }
  getSectionOutlineElements(id: number): Element[] {
    return this.getSectionMetadata(id) ? [] : [];
  }
  getSeatMetadata(id: number): ISeatMetadata | null {
    return this.seatCache.get(id);
  }
  getAllSeatMetadata(sectionId?: number): ISeatMetadata[] {
    return this.seatCache.all().filter((s) => sectionId === undefined || s.sectionId === sectionId);
  }
  private invalidate(kind: 'seats' | 'sections', id?: number): void {
    const cache = kind === 'seats' ? this.seatCache : this.sectionCache;
    cache.invalidate(id);
    this.emit(kind === 'seats' ? 'seatsChanged' : 'sectionsChanged', id);
  }
  invalidateSection(id: number): void {
    this.invalidate('sections', id);
  }
  invalidateSections(): void {
    this.invalidate('sections');
  }
  invalidateSeat(id: number): void {
    this.invalidate('seats', id);
  }
  invalidateSeats(): void {
    this.invalidate('seats');
  }
  invalidateAll(): void {
    for (const group of ['sections', 'seats'] as const) this.invalidate(group);
    this.emit('dataInvalidated');
  }
  notifyDataLoaded(): void {
    this.invalidateAll();
    this.emit('dataLoaded');
  }
  refresh(): void {
    this.sectionCache.refresh();
    this.seatCache.refresh();
  }
  destroy(): void {
    this.sectionCache.destroy();
    this.seatCache.destroy();
    this.listeners.clear();
  }
}
export type StateEventType = 'sectionStateChanged' | 'seatStateChanged';
export class StateManager {
  private listeners = new Map<StateEventType, Set<(id: number) => void>>();
  constructor(
    private data: DataManager,
    private update: (id: number, states: Partial<IEntityStates>) => void,
  ) {}
  on(event: StateEventType, callback: (id: number) => void): void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(callback);
    this.listeners.set(event, listeners);
  }
  off(event: StateEventType, callback: (id: number) => void): void {
    this.listeners.get(event)?.delete(callback);
  }
  getSectionStates(id: number): IEntityStates | null {
    return this.data.getSectionMetadata(id)?.states ?? null;
  }
  updateSectionState(id: number, states: Partial<IEntityStates>): void {
    this.update(id, states);
    this.notifySectionStateChanged(id);
  }
  toggleSectionState(id: number, key: keyof IEntityStates): boolean {
    const state = this.getSectionStates(id);
    if (!state) return false;
    const value = !state[key];
    this.updateSectionState(id, { [key]: value });
    return value;
  }
  clearSectionStates(id: number): void {
    this.updateSectionState(id, {
      highlighted: false,
      selected: false,
      unavailable: false,
      filtered: false,
    });
  }
  clearAllHighlights(): void {
    for (const section of this.data.getAllSectionMetadata())
      this.updateSectionState(section.id, { highlighted: false });
  }
  notifySectionStateChanged(id: number): void {
    this.listeners.get('sectionStateChanged')?.forEach((callback) => callback(id));
  }
  destroy(): void {
    this.listeners.clear();
  }
}
