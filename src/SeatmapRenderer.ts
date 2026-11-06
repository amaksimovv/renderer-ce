import type { BookingClient } from './BookingClient.js';
import { getBounds, SeatIndex, Viewport } from './geometry.js';
import { bindInteractions } from './interactions.js';
import type { SeatPainter } from './paint.js';
import { defaultTheme } from './paint.js';
import { ProjectionWindow } from './ProjectionWindow.js';
import { ViewportAnimation } from './ViewportAnimation.js';
import { OutlineLayer } from './OutlineLayer.js';
import { HoverLayer } from './HoverLayer.js';
import { SelectionLayer } from './SelectionLayer.js';
import { maskRegions } from './overlayPaint.js';
import { SvgBackgroundLayer } from './SvgBackgroundLayer.js';
import type {
  BackgroundStatus,
  BookingSnapshot,
  Bounds,
  MapOutline,
  Point,
  RendererTheme,
  Seat,
  SeatId,
  SeatmapData,
  SelectionResult,
} from './types.js';

export interface RendererOptions {
  readonly seatStyle?: SeatPainter;
  readonly client: BookingClient;
  readonly seatRadius?: number;
  readonly theme?: Partial<RendererTheme>;
  readonly ariaLabel?: string;
  readonly onSeatActivate?: (seat: Seat) => void;
  readonly autoFocusOutline?: boolean;
  readonly hotkeys?: boolean;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly initialPadding?: number;
  readonly maxFitScale?: number;
  readonly panPadding?: number;
  readonly bounds?: () => Bounds | undefined;
  readonly zoomDuration?: number;
  readonly onZoomStart?: (scale: number, previous: number) => void;
  readonly onZoomEnd?: (scale: number, previous: number) => void;
  readonly onRedrawStart?: () => void;
  readonly onRedrawEnd?: () => void;
  readonly onOverlayDraw?: (context: CanvasRenderingContext2D, viewport: Viewport) => void;
  readonly onHover?: (seat: Seat | undefined) => void;
  readonly onSelectionError?: (reason: Extract<SelectionResult, { ok: false }>['reason']) => void;
  readonly onBackgroundError?: (error: Error) => void;
  readonly onOutlineHover?: (outline: MapOutline | undefined) => void;
  readonly onOutlineClick?: (outline: MapOutline) => void;
}

let rendererSequence = 0;

export class SeatmapRenderer {
  readonly element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private hoverLayer: HoverLayer;
  private selectionLayer: SelectionLayer;
  private selectedIds = new Set<SeatId>();
  private accessible: HTMLDivElement;
  private status: HTMLDivElement;
  private optionElements = new Map<SeatId, HTMLDivElement>();
  private view = new Viewport();
  private projection = new ProjectionWindow();
  private animation = new ViewportAnimation(
    this.view,
    () => this.schedule(),
    (scale, previous) => {
      if (this.initialized) this.options.onZoomStart?.(scale, previous);
    },
    (scale, previous) => {
      if (this.initialized) this.options.onZoomEnd?.(scale, previous);
    },
  );
  private initialized = false;
  private index: SeatIndex;
  private data: SeatmapData;
  private outlines = new OutlineLayer();
  private background: SvgBackgroundLayer;
  private hoveredOutline: MapOutline | undefined;
  private radius: number;
  private theme: RendererTheme;
  private width = 1;
  private height = 1;
  private frame: number | undefined;
  private mapFrame = false;
  private selectionFrame = false;
  private hovered: Seat | undefined;
  private focused: Seat | undefined;
  private keyboardFocus = false;
  private destroyed = false;
  private observer: ResizeObserver;
  private unsubscribe: () => void;
  private unbind: () => void;
  private events = new AbortController();
  private id = `seatmap-ce-${++rendererSequence}`;

  constructor(
    container: HTMLElement,
    private readonly options: RendererOptions,
  ) {
    this.view.initialPadding = options.initialPadding;
    this.view.maxFitScale = options.maxFitScale;
    this.view.minScale = options.minZoom;
    this.view.maxScale = options.maxZoom;
    this.radius = options.seatRadius ?? 8;
    if (!Number.isFinite(this.radius) || this.radius <= 0)
      throw new RangeError('seatRadius must be positive');
    this.theme = { ...defaultTheme, ...options.theme };
    this.data = options.client.data;
    this.index = new SeatIndex(this.data.seats);
    this.element = document.createElement('div');
    this.element.style.cssText =
      'position:relative;width:100%;height:100%;min-height:120px;overflow:hidden;';
    this.element.tabIndex = 0;
    this.element.setAttribute('role', 'listbox');
    this.element.setAttribute(
      'aria-label',
      options.ariaLabel ??
        'Seat map. Use arrow keys to move, Enter to select, plus or minus to zoom, and 0 to fit.',
    );
    this.element.setAttribute('aria-multiselectable', 'true');
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.seatmapLayer = 'map';
    this.canvas.style.cssText =
      'display:block;width:100%;height:100%;touch-action:none;cursor:grab;';
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not supported in this browser');
    this.context = context;
    this.hoverLayer = new HoverLayer(this.canvas);
    this.selectionLayer = new SelectionLayer(this.canvas);
    this.outlines.set(this.data.outlines ?? []);
    this.background = new SvgBackgroundLayer((status) => {
      this.element.dataset.backgroundStatus = status;
      this.projection.invalidate();
      this.schedule();
    }, options.onBackgroundError);
    this.accessible = document.createElement('div');
    this.accessible.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
    this.status = document.createElement('div');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.style.cssText = this.accessible.style.cssText;
    this.element.append(
      this.canvas,
      this.selectionLayer.canvas,
      this.hoverLayer.canvas,
      this.accessible,
      this.status,
    );
    container.append(this.element);
    this.buildOptions();
    this.selectedIds = new Set(options.client.snapshot.seatIds);
    this.unsubscribe = options.client.subscribe((snapshot) => {
      this.sync(snapshot);
    });
    this.unbind = bindInteractions({
      canvas: this.canvas,
      viewport: this.view,
      interrupt: () => {
        this.animation.cancel();
        this.keyboardFocus = false;
        this.schedule(false);
      },
      zoom: (factor, anchor) => this.zoom(factor, anchor, 180),
      click: (point) => {
        this.keyboardFocus = false;
        this.schedule(false);
        const seat = this.hit(point);
        if (seat) {
          this.setFocused(seat);
          this.toggle(seat);
        } else {
          const outline = this.outlines.hit(this.context, this.view.toWorld(point));
          if (outline) {
            if (options.autoFocusOutline !== false) this.focusOutline(outline.id);
            options.onOutlineClick?.(outline);
          }
        }
      },
      hover: (point) => {
        const hovered = point ? this.hit(point) : undefined;
        const outline = point
          ? this.outlines.hit(this.context, this.view.toWorld(point))
          : undefined;
        if (hovered === this.hovered && outline === this.hoveredOutline) return;
        this.hovered = hovered;
        this.hoveredOutline = outline;
        this.canvas.style.cursor =
          this.hovered?.status === 'unavailable'
            ? 'not-allowed'
            : this.hovered || this.hoveredOutline
              ? 'pointer'
              : 'grab';
        options.onHover?.(this.hovered);
        options.onOutlineHover?.(this.hoveredOutline);
        this.schedule(false);
      },
      redraw: () => {
        this.schedule();
      },
    });
    this.element.addEventListener(
      'keydown',
      (event) => {
        this.keydown(event);
      },
      { signal: this.events.signal },
    );
    this.element.addEventListener(
      'focus',
      () => {
        this.keyboardFocus = this.element.matches(':focus-visible');
        this.schedule(false);
      },
      { signal: this.events.signal },
    );
    this.element.addEventListener(
      'blur',
      () => {
        this.keyboardFocus = false;
        this.schedule(false);
      },
      { signal: this.events.signal },
    );
    this.observer = new ResizeObserver(() => {
      this.resize();
    });
    this.observer.observe(this.element);
    this.background.set(this.data.background);
    this.resize();
    this.initialized = true;
  }

  get backgroundStatus(): BackgroundStatus {
    return this.background.status;
  }

  focusOutline(id: string): boolean {
    if (this.destroyed) return false;
    const outline = this.data.outlines?.find((item) => item.id === id);
    if (!outline) return false;
    void this.focusBounds(outline.bounds, this.options.zoomDuration ?? 400);
    this.status.textContent = `Showing ${outline.label}`;
    this.schedule();
    return true;
  }

  fit(duration = 0): void {
    if (this.destroyed) return;
    const target = Object.assign(new Viewport(), this.view);
    target.fit(
      this.options.bounds?.() ?? getBounds(this.data, this.radius),
      this.width,
      this.height,
    );
    this.view.fitScale = target.fitScale;
    void this.animation.to({ x: target.x, y: target.y, scale: target.scale }, duration);
  }

  zoomIn(): void {
    this.zoom(1.3);
  }
  zoomOut(): void {
    this.zoom(1 / 1.3);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer.disconnect();
    this.events.abort();
    this.unsubscribe();
    this.unbind();
    this.background.destroy();
    this.outlines.destroy();
    this.animation.cancel();
    this.projection.destroy();
    this.selectionLayer.destroy();
    this.hoverLayer.destroy();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.element.remove();
    this.optionElements.clear();
  }

  getViewport(): Viewport {
    return this.view;
  }
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
  redraw(): void {
    this.projection.invalidate();
    this.schedule();
  }
  focusBounds(bounds: Bounds, duration = 0): Promise<void> {
    this.resize();
    const target = Object.assign(new Viewport(), this.view);
    target.focus(bounds, this.width, this.height);
    return this.animation.to({ x: target.x, y: target.y, scale: target.scale }, duration);
  }
  zoomTo(scale: number, destination?: Point, duration = 0): Promise<void> {
    if (this.destroyed || !Number.isFinite(scale) || scale <= 0) return Promise.resolve();
    this.resize();
    const target = Object.assign(new Viewport(), this.view);
    const center = target.toWorld({ x: this.width / 2, y: this.height / 2 });
    target.scale = scale;
    target.x = this.width / 2 - center.x * scale;
    target.y = this.height / 2 - center.y * scale;
    if (destination) {
      target.x = this.width / 2 - destination.x * target.scale;
      target.y = this.height / 2 - destination.y * target.scale;
    }
    if (this.options.panPadding !== undefined) {
      const bounds = this.options.bounds?.() ?? getBounds(this.data, this.radius);
      const limit = (value: number, browser: number, world: number) => {
        const start = this.options.panPadding! * browser;
        const size = world * target.scale + 2 * start;
        return size < browser
          ? (browser - size) / 2 + start
          : Math.max(browser - size + start, Math.min(start, value));
      };
      target.x = limit(target.x, this.width, bounds.width);
      target.y = limit(target.y, this.height, bounds.height);
    }
    return this.animation.to({ x: target.x, y: target.y, scale: target.scale }, duration);
  }

  stopAnimation(): void {
    this.animation.cancel();
  }

  getTargetZoom(): number {
    return this.animation.target.scale;
  }

  private zoom(
    factor: number,
    anchor = { x: this.width / 2, y: this.height / 2 },
    duration = this.options.zoomDuration ?? 400,
  ): void {
    if (this.destroyed) return;
    const target = Object.assign(new Viewport(), this.view, this.animation.target);
    target.zoom(factor, anchor);
    void this.animation.to({ x: target.x, y: target.y, scale: target.scale }, duration);
  }

  private resize(): void {
    if (this.destroyed) return;
    const rect = this.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    if (
      this.width === rect.width &&
      this.height === rect.height &&
      this.canvas.width === Math.round(rect.width * ratio)
    )
      return;
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.projection.invalidate();
    this.fit();
  }

  private hit(point: Point): Seat | undefined {
    return this.index.hit(this.view.toWorld(point), this.radius);
  }

  private buildOptions(): void {
    const previous = this.focused?.id;
    this.optionElements.clear();
    const fragment = document.createDocumentFragment();
    this.data.seats.forEach((seat, i) => {
      const element = document.createElement('div');
      element.id = `${this.id}-seat-${i}`;
      element.setAttribute('role', 'option');
      element.setAttribute('aria-selected', String(this.options.client.isSelected(seat.id)));
      element.setAttribute('aria-disabled', String(seat.status === 'unavailable'));
      element.textContent = this.describe(seat);
      this.optionElements.set(seat.id, element);
      fragment.append(element);
    });
    this.accessible.replaceChildren(fragment);
    this.focused =
      this.data.seats.find((seat) => seat.id === previous) ??
      this.data.seats.find((seat) => seat.status !== 'unavailable') ??
      this.data.seats[0];
    if (this.focused) this.setFocused(this.focused);
    else this.element.removeAttribute('aria-activedescendant');
  }

  private sync(snapshot: BookingSnapshot): void {
    const dataChanged = this.data !== this.options.client.data;
    if (dataChanged) {
      this.projection.invalidate();
      const previousBounds = getBounds(this.data, this.radius);
      this.data = this.options.client.data;
      this.index.update(this.data.seats);
      this.outlines.set(this.data.outlines ?? []);
      this.background.set(this.data.background);
      this.hovered = undefined;
      this.hoveredOutline = undefined;
      this.options.onHover?.(undefined);
      this.options.onOutlineHover?.(undefined);
      this.buildOptions();
      if (JSON.stringify(previousBounds) !== JSON.stringify(getBounds(this.data, this.radius)))
        this.fit();
    }
    const selected = new Set(snapshot.seatIds);
    if (!dataChanged)
      for (const id of new Set([...this.selectedIds, ...selected]))
        if (this.selectedIds.has(id) !== selected.has(id))
          this.optionElements.get(id)?.setAttribute('aria-selected', String(selected.has(id)));
    this.selectedIds = selected;
    this.status.textContent = `${snapshot.count} seats selected`;
    this.schedule(dataChanged, true);
  }

  private describe(seat: Seat): string {
    const category = this.data.categories?.find((item) => item.id === seat.category);
    return [
      seat.section,
      seat.row === undefined ? undefined : `Row ${seat.row}`,
      `Seat ${seat.label}`,
      category?.label,
      seat.accessible ? 'Accessible' : undefined,
      seat.status === 'unavailable' ? 'Unavailable' : 'Available',
    ]
      .filter(Boolean)
      .join(', ');
  }

  private toggle(seat: Seat): void {
    if (this.options.onSeatActivate) {
      this.options.onSeatActivate(seat);
      return;
    }
    const result = this.options.client.toggle(seat.id);
    if (!result.ok) {
      this.status.textContent =
        result.reason === 'limit'
          ? `You can select up to ${this.options.client.maxSelection} seats`
          : 'This seat is unavailable';
      this.options.onSelectionError?.(result.reason);
    }
    this.schedule(false, true);
  }

  private setFocused(seat: Seat): void {
    this.focused = seat;
    const element = this.optionElements.get(seat.id);
    if (element) this.element.setAttribute('aria-activedescendant', element.id);
  }

  private keydown(event: KeyboardEvent): void {
    if (this.options.hotkeys === false) return;
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction && !['Enter', ' ', '+', '=', '-', '0', 'Home', 'End'].includes(event.key))
      return;
    event.preventDefault();
    if (direction || event.key === 'Home' || event.key === 'End') this.animation.cancel();
    this.keyboardFocus = true;
    if (direction && this.focused) this.moveFocus(direction);
    else if ((event.key === 'Enter' || event.key === ' ') && this.focused)
      this.toggle(this.focused);
    else if (event.key === '+' || event.key === '=') this.zoomIn();
    else if (event.key === '-') this.zoomOut();
    else if (event.key === '0') this.fit(this.options.zoomDuration ?? 400);
    else if (event.key === 'Home' || event.key === 'End') {
      const seat = event.key === 'Home' ? this.data.seats[0] : this.data.seats.at(-1);
      if (seat) this.setFocused(seat);
    }
    if (this.focused && (direction || event.key === 'Home' || event.key === 'End')) {
      const point = this.view.toScreen(this.focused);
      const margin = Math.min(30, this.width / 4, this.height / 4);
      this.view.x += Math.max(margin, Math.min(this.width - margin, point.x)) - point.x;
      this.view.y += Math.max(margin, Math.min(this.height - margin, point.y)) - point.y;
    }
    this.schedule(!['Enter', ' '].includes(event.key));
  }

  private moveFocus(direction: Point): void {
    if (!this.focused) return;
    let best: Seat | undefined;
    let bestScore = Infinity;
    for (const seat of this.data.seats) {
      const dx = seat.x - this.focused.x;
      const dy = seat.y - this.focused.y;
      const forward = dx * direction.x + dy * direction.y;
      if (forward <= 0.01) continue;
      const cross = Math.abs(dx * direction.y - dy * direction.x);
      const score = forward + cross * 4;
      if (score < bestScore) {
        best = seat;
        bestScore = score;
      }
    }
    if (best) this.setFocused(best);
  }

  private schedule(map = true, selection = map): void {
    if (this.destroyed) return;
    this.mapFrame ||= map;
    this.selectionFrame ||= selection;
    if (this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      const drawMap = this.mapFrame;
      const drawSelection = this.selectionFrame;
      this.mapFrame = false;
      this.selectionFrame = false;
      this.options.onRedrawStart?.();
      const options = {
        index: this.index,
        seatStyle: this.options.seatStyle,
        context: this.context,
        client: this.options.client,
        viewport: this.view,
        theme: this.theme,
        width: this.width,
        height: this.height,
        pixelRatio: this.canvas.width / this.width,
        radius: this.radius,
        backgroundImage: this.background.image,
        outlines: this.outlines,
      };
      if (drawMap) {
        this.projection.draw(
          { ...options, selection: false },
          this.animation.active,
          this.animation.active ? this.animation.target : undefined,
        );
        this.options.onOverlayDraw?.(this.context, this.view);
      }
      if (drawSelection) this.selectionLayer.draw(options);
      const hoverRegions = this.hoverLayer.draw(
        options,
        this.hovered,
        this.keyboardFocus ? this.focused : undefined,
        this.hoveredOutline?.id,
      );
      maskRegions(this.canvas, [...this.selectionLayer.regions, ...hoverRegions]);
      maskRegions(this.selectionLayer.canvas, hoverRegions);
      this.options.onRedrawEnd?.();
    });
  }
}
