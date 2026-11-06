import { seatStyle } from './seatStyles.js';
import type {
  DataManager as DataManagerContract,
  StateManager as StateManagerContract,
} from './manager-types.js';
import type { ISeat } from './models.js';
import type { Context } from './settings.js';
import { SeatmapRenderer } from '../SeatmapRenderer.js';
import { ViewportControls } from './ViewportControls.js';
import { BookingApiClient, ApiError, unpackSchema } from './ApiClient.js';
import { DataManager, StateManager } from './Managers.js';
import { UnsupportedFeatureError } from './settings.js';
import type { IBookingRendererSettings } from './settings.js';
import type { ISchemaDTO, IPriceListDTO } from './api-types.js';
import type { IRenderer } from './IRenderer.js';
import type {
  IEntityStates,
  ISeatMetadata,
  ISectionMetadata,
  ILoaderSettings,
  LoadingPhase,
} from './models.js';

export class SeatmapBookingRenderer extends ViewportControls implements IRenderer {
  static readonly VERSION = '0.1.1';
  private api: BookingApiClient;
  private request?: AbortController;
  private dataManager: DataManager;
  private stateManager: StateManager;
  private hoverId?: number;
  private hoverSection?: number;
  private debounce?: ReturnType<typeof setTimeout>;
  private loader?: HTMLDivElement;
  private drawContext?: Context;
  private contextSeats?: Map<number, ISeat>;
  private oldView?: { x: number; y: number; scale: number };

  constructor(
    element: HTMLElement,
    settings: IBookingRendererSettings = {},
    tags?: Record<string, string | number | boolean>,
  ) {
    if (settings.enable3DView) throw new UnsupportedFeatureError('3D view');
    super(element, settings);
    this.api = new BookingApiClient(settings);
    if (settings.height) element.style.height = `${settings.height}px`;
    if (settings.width) element.style.width = `${settings.width}px`;
    if (element.clientHeight <= 0 && !settings.height) element.style.height = '100vh';
    this.canvas = new SeatmapRenderer(element, {
      client: this.client,
      seatStyle: (seat, state, base) => {
        const original = this.seats.get(Number(seat.id));
        if (!original || !this.drawContext) return base;
        const category = original.categoryKey ?? original.special?.category;
        const color =
          category === undefined
            ? this.prices.find((price) => price.id === original.priceId)?.color
            : this.getCategoryColor(category);
        return seatStyle(
          this.settings,
          original,
          state,
          color ? { ...base, color } : base,
          this.drawContext,
        );
      },
      initialPadding: settings.initialPadding || 0.85,
      maxFitScale: settings.zoomSettings?.maxZoomToFitScale ?? 1,
      panPadding: settings.padding ?? 0.5,
      bounds: () => this.schema?.background.viewBox,
      minZoom: settings.zoomSettings?.minPinchZoom,
      maxZoom: settings.zoomSettings?.maxPinchZoom ?? 2,
      zoomDuration: settings.zoomAnimationDuration ?? 400,
      onZoomStart: (scale, previous) =>
        this.settings.onZoomStart?.(
          scale * (window.devicePixelRatio || 1),
          previous * (window.devicePixelRatio || 1),
        ),
      onZoomEnd: (scale, previous) =>
        this.settings.onZoomEnd?.(
          scale * (window.devicePixelRatio || 1),
          previous * (window.devicePixelRatio || 1),
        ),
      seatRadius: (settings.theme?.seatStyles?.default?.size ?? 16) / 2,
      theme: { background: settings.theme?.bgColor ?? '#f7f7f7', selectedText: '#fff' },
      hotkeys: settings.hotkeys !== false,
      autoFocusOutline: false,
      onSeatActivate: (seat) => {
        if (this.mode !== 'pan') void this.activateSeat(Number(seat.id));
      },
      onHover: (seat) => this.hoverSeat(seat ? Number(seat.id) : undefined),
      onOutlineHover: (outline) =>
        this.hoverOutline(outline ? Number(outline.id.split(':')[0]) : undefined),
      onOutlineClick: (outline) => {
        const id = Number(outline.id.split(':')[0]),
          section = this.sectionView(id);
        if (!section) return;
        this.settings.onSectorClick?.(section);
        this.settings.onSectionClick?.(section);
        if (section.ga) this.setSelectedGa(id);
        else this.zoomToSection(id);
      },
      onRedrawStart: () => {
        if (this.canvas) {
          const view = this.canvas.getViewport();
          if (this.contextSeats !== this.seats || !this.drawContext) {
            this.contextSeats = this.seats;
            this.drawContext = {
              seats: [...this.seats.values()],
              seatsById: Object.fromEntries(this.seats),
              rowsById: Object.fromEntries(this.rows),
              sectionsById: Object.fromEntries(this.sections),
              settings: this.settings,
              scale: view.scale * (window.devicePixelRatio || 1),
              translate: {
                x: view.x * (window.devicePixelRatio || 1),
                y: view.y * (window.devicePixelRatio || 1),
              },
              getCart: () => this.getCart(),
            };
          } else {
            this.drawContext.scale = view.scale * (window.devicePixelRatio || 1);
            this.drawContext.translate = {
              x: view.x * (window.devicePixelRatio || 1),
              y: view.y * (window.devicePixelRatio || 1),
            };
          }
        }
        this.settings.onRedrawStart?.();
      },
      onRedrawEnd: () => {
        this.viewChanged();
        this.settings.onRedrawEnd?.();
      },
      onOverlayDraw: (context, view) => this.drawOverlays(context, view),
      onBackgroundError: (error) => {
        this.canvas.element.dispatchEvent(
          new CustomEvent('seatmap:background-error', { detail: { message: error.message } }),
        );
      },
    });
    this.dataManager = new DataManager(
      () => this.sectionMetadata(),
      () => this.seatMetadata(),
    );
    this.stateManager = new StateManager(this.dataManager, (id, states) =>
      this.updateSection(id, states),
    );
    if (settings.minimap?.enabled) this.showMinimap();
    if (tags) this.canvas.element.dataset.tagCount = String(Object.keys(tags).length);
  }

  protected override invalidateSeats(): void {
    this.dataManager?.invalidateSeats();
  }
  protected override invalidateSections(): void {
    this.dataManager?.invalidateSections();
  }

  getVersion(): string {
    return SeatmapBookingRenderer.VERSION;
  }
  getDataManager(): DataManagerContract {
    return this.dataManager;
  }
  getStateManager(): StateManagerContract {
    return this.stateManager;
  }

  async loadEvent(eventId: string, sectorId?: number): Promise<void> {
    if (this.destroyed) throw new Error('Renderer has been destroyed');
    if (!this.settings.publicKey) throw new Error('Public key is undefined');
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.loading = true;
    this.revision++;
    this.showLoader('Loading event');
    try {
      const schemaPromise = this.api.fetchSchemaForEvent(eventId, request.signal);
      const pricesPromise = this.api.fetchPricesForEvent(eventId, request.signal);
      const rowsPromise = this.api.fetchRowsSvgForEvent(eventId, request.signal);
      const complete = Promise.all([schemaPromise, pricesPromise, rowsPromise]);
      void complete.catch(() => undefined);
      const schema = await schemaPromise;
      if (request.signal.aborted || this.destroyed) return;
      this.progress('schema', 35);
      if (schema.background.svgLink && !schema.background.svg) {
        const response = await fetch(schema.background.svgLink, {
          signal: request.signal,
          credentials: 'omit',
        });
        if (!response.ok) throw new ApiError(response.status);
        schema.background.svg = await response.text();
        delete schema.background.svgLink;
      }
      if (request.signal.aborted || this.destroyed) return;
      this.installSchema(this.prepareSchema(schema, sectorId));
      this.settings.onSchemaDataLoaded?.();
      this.canvas.fit();
      const [, prices, rows] = await complete;
      if (request.signal.aborted || this.destroyed) return;
      this.progress('prices', 65);
      this.applyRows(rows);
      this.progress('rows', 85);
      this.installPrices(prices);
      this.setExternalPrices();
      this.dataManager.notifyDataLoaded();
      if (sectorId !== undefined) this.zoomToSection(sectorId);
      this.progress('processing', 100);
    } catch (error) {
      if (request.signal.aborted || this.destroyed) return;
      const message =
        error instanceof ApiError
          ? SeatmapBookingRenderer.getErrorMessage(error, this.settings.loader?.errorTexts).title
          : 'Failed to load event';
      this.showLoader(message, true);
      throw error;
    } finally {
      if (this.request === request) {
        this.loading = false;
        if (this.loader?.dataset.error !== 'true') this.loader?.remove();
      }
    }
  }

  async loadData(schema: ISchemaDTO, prices: IPriceListDTO): Promise<void> {
    if (this.destroyed) throw new Error('Renderer has been destroyed');
    const prepared = this.prepareSchema(unpackSchema(schema));
    const preparedPrices = structuredClone(prices);
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.loading = true;
    this.revision++;
    this.showLoader('Loading venue');
    try {
      this.installSchema(prepared);
      this.settings.onSchemaDataLoaded?.();
      if (request.signal.aborted || this.destroyed) return;
      this.canvas.fit();
      this.installPrices(preparedPrices);
      this.setExternalPrices();
      this.dataManager.notifyDataLoaded();
      this.progress('processing', 100);
    } catch (error) {
      this.showLoader('Failed to load data', true);
      throw error;
    } finally {
      if (this.request === request) {
        this.loading = false;
        if (this.loader?.dataset.error !== 'true') this.loader?.remove();
      }
    }
  }

  private prepareSchema(schema: ISchemaDTO, sectorId?: number): ISchemaDTO {
    const next = structuredClone(schema);
    if (next.background.svg)
      next.background.svg = next.background.svg.replace(/<!DOCTYPE[^>]*>/gi, '');
    if (sectorId !== undefined) {
      next.seats = next.seats.filter((s) => s.sectorId === sectorId);
      next.rows = next.rows.filter((r) => r.sectorId === sectorId);
      next.sectors = next.sectors.filter((s) => s.id === sectorId);
    }
    return next;
  }
  private applyRows(rowsSvg?: string): void {
    const next = this.schema;
    if (this.settings.showRows && rowsSvg && next?.background.svg) {
      const base = new DOMParser().parseFromString(next.background.svg, 'image/svg+xml');
      const rows = new DOMParser().parseFromString(rowsSvg, 'image/svg+xml');
      if (!rows.querySelector('parsererror'))
        for (const node of [...rows.documentElement.children])
          base.documentElement.append(base.importNode(node, true));
      next.background.svg = new XMLSerializer().serializeToString(base.documentElement);
    }
  }
  private progress(phase: LoadingPhase, progress: number): void {
    this.settings.onLoadProgress?.({
      phase,
      progress,
      isIndeterminate: false,
      message: `Loading ${phase}`,
    });
  }
  private showLoader(text: string, error = false): void {
    if (this.settings.loader?.enabled === false) return;
    this.loader?.remove();
    this.loader = document.createElement('div');
    this.loader.setAttribute('role', error ? 'alert' : 'status');
    this.loader.textContent = text;
    this.loader.dataset.error = String(error);
    this.loader.style.cssText =
      'position:absolute;inset:0;display:grid;place-items:center;background:#ffffffdd;color:#20251f;font:16px sans-serif;z-index:2';
    this.canvas.element.append(this.loader);
  }
  static getErrorMessage(
    error: ApiError,
    errorTexts?: ILoaderSettings['errorTexts'],
  ): { title: string; subtitle: string } {
    const messages: Record<string, [keyof NonNullable<typeof errorTexts>, string, string]> = {
      EVENT_ARCHIVED: [
        'eventArchived',
        'Event is no longer available',
        'This event has been archived',
      ],
      EVENT_NOT_PUBLISHED: [
        'eventNotPublished',
        'Event is not available',
        'This event has not been published yet',
      ],
      ENTITY_NOT_FOUND: ['eventNotFound', 'Event not found', 'The requested event does not exist'],
    };
    const code = error.errorCode ?? '';
    const [key, title, subtitle] = Object.hasOwn(messages, code)
      ? messages[code]!
      : ['genericError' as const, 'Failed to load event', `Error ${error.status}`];
    const custom = errorTexts?.[key];
    return { title: custom?.title ?? title, subtitle: custom?.subtitle ?? subtitle };
  }

  private hoverSeat(id: number | undefined): void {
    if (id === this.hoverId) return;
    clearTimeout(this.debounce);
    if (this.hoverId !== undefined) this.settings.onSeatMouseLeave?.();
    this.hoverId = id;
    const seat = id !== undefined ? this.seats.get(id) : undefined;
    if (!seat) return;
    this.settings.onSeatMouseEnter?.(this.seatToExtendedSeat(seat));
    this.debounce = setTimeout(() => {
      if (!this.destroyed) this.settings.onSeatDebouncedEnter?.(this.seatToExtendedSeat(seat));
    }, this.settings.debounceDelay ?? 400);
  }
  private hoverOutline(id: number | undefined): void {
    if (id === this.hoverSection) return;
    if (this.hoverSection !== undefined) this.settings.onSectorMouseLeave?.();
    this.hoverSection = id;
    const section = id !== undefined ? this.sectionView(id) : undefined;
    if (section) this.settings.onSectorMouseEnter?.(section);
  }
  private viewChanged(): void {
    if (!this.canvas) return;
    const view = this.canvas.getViewport(),
      old = this.oldView;
    this.oldView = { x: view.x, y: view.y, scale: view.scale };
    if (old && old.scale === view.scale && (old.x !== view.x || old.y !== view.y))
      this.settings.onPan?.({ x: view.x - old.x, y: view.y - old.y }, true);
  }
  private sectionMetadata(): ISectionMetadata[] {
    return this.getSections().map((s) => {
      const bounds = this.sectionBounds(s.id);
      return {
        id: s.id,
        name: s.name,
        guid: s.guid,
        type: s.type ?? undefined,
        elementCount: this.outlines.filter((o) => o.id.startsWith(`${s.id}:`)).length,
        seatCount:
          [...this.seats.values()].filter((seat) => seat.sectorId === s.id).length || undefined,
        priceId: s.priceId,
        isGa: s.isGa,
        disabled: s.disabled,
        filtered: s.filtered,
        bounds: new DOMRect(bounds.x, bounds.y, bounds.width, bounds.height),
        center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        centerOutsideViewBox: this.schema
          ? bounds.x + bounds.width / 2 < this.schema.background.viewBox.x ||
            bounds.x + bounds.width / 2 >
              this.schema.background.viewBox.x + this.schema.background.viewBox.width ||
            bounds.y + bounds.height / 2 < this.schema.background.viewBox.y ||
            bounds.y + bounds.height / 2 >
              this.schema.background.viewBox.y + this.schema.background.viewBox.height
          : false,
        outlineSource: this.outlines.find((o) => o.id.startsWith(`${s.id}:`))?.source,
        states: {
          highlighted: this.highlightedSection === s.id,
          selected: this.selectedSections.has(s.id),
          unavailable: s.disabled ?? false,
          filtered: s.filtered ?? false,
        },
      };
    });
  }
  private seatMetadata(): ISeatMetadata[] {
    const cart = new Set(this.cart.seats.map((s) => s.id));
    return [...this.seats.values()].map((s) => ({
      id: s.id,
      key: s.name,
      sectionId: s.sectorId,
      sectionName: this.sections.get(s.sectorId)?.name,
      row: this.rows.get(s.rowId)?.rowNumber?.toString(),
      seat: s.name,
      x: s.x,
      y: s.y,
      priceId: s.priceId,
      available: s.state !== 'unavailable' && !s.locked,
      locked: s.locked,
      filtered: s.filtered,
      inCart: cart.has(s.id),
      states: {
        highlighted: false,
        selected: cart.has(s.id),
        unavailable: s.state === 'unavailable' || !!s.locked,
        filtered: s.filtered ?? false,
      },
    }));
  }
  private updateSection(id: number, states: Partial<IEntityStates>): void {
    const section = this.sections.get(id);
    if (!section) return;
    if (states.highlighted !== undefined)
      this.highlightedSection = states.highlighted ? id : undefined;
    if (states.selected !== undefined) {
      if (states.selected) this.selectedSections.add(id);
      else this.selectedSections.delete(id);
    }
    if (states.unavailable !== undefined) section.disabled = states.unavailable;
    if (states.filtered !== undefined) section.filtered = states.filtered;
    this.refresh();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.revision++;
    this.request?.abort();
    clearTimeout(this.debounce);
    this.destroyControls();
    this.dataManager.destroy();
    this.stateManager.destroy();
    this.canvas.destroy();
  }
}
