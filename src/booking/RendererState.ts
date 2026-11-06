import { priceLegend } from './price-colors.js';
import { BookingClient } from '../BookingClient.js';
import type { SeatmapRenderer } from '../SeatmapRenderer.js';
import type { MapOutline, SeatmapData } from '../types.js';
import type { IPriceListDTO, ISchemaDTO, IRowDTO, ISeatDTO } from './api-types.js';
import type {
  ICart,
  ISeat,
  ISector,
  ISeatPriceScheme,
  IExtendedSeat,
  ISection,
  ISectionWithCoords,
  IMarker,
} from './models.js';
import type { IBookingRendererSettings, IColoredPrice } from './settings.js';
import { svgOutlines, fallbackOutlines, pointBounds } from './outlines.js';

export class RendererState {
  protected settings: IBookingRendererSettings;
  protected client: BookingClient;
  protected canvas!: SeatmapRenderer;
  protected schema?: ISchemaDTO;
  protected seats = new Map<number, ISeat>();
  protected rows = new Map<number, IRowDTO>();
  protected sections = new Map<number, ISector>();
  protected prices: IColoredPrice[] = [];
  protected categoryColors = new Map<string | number, string>();
  protected gaCategories = new Map<number, string | number>();
  protected priceList: IPriceListDTO = { seats: [], groupOfSeats: [], prices: [] };
  protected outlines: MapOutline[] = [];
  protected cart: ICart = { seats: [], ga: [] };
  protected externalPrices: ISeatPriceScheme[] = [];
  protected selectedSeats = new Set<number>();
  protected selectedSections = new Set<number>();
  protected selectedGa?: number;
  protected highlightedSection?: number;
  protected markers = new Map<string, IMarker>();
  protected destroyed = false;
  protected loading = false;
  protected revision = 0;
  protected mode = 'select';

  constructor(
    protected host: HTMLElement,
    settings: IBookingRendererSettings,
  ) {
    this.settings = { ...settings };
    this.client = new BookingClient({
      data: { seats: [] },
      maxSelection: Number.MAX_SAFE_INTEGER,
    });
    this.externalPrices = settings.seatsPrices ?? [];
  }

  protected installSchema(schema: ISchemaDTO): void {
    this.schema = schema;
    this.prices = [];
    this.priceList = { seats: [], groupOfSeats: [], prices: [] };
    this.seats = new Map(schema.seats.map((seat) => [seat.id, { ...seat }]));
    this.rows = new Map(schema.rows.map((row) => [row.id, { ...row }]));
    this.sections = new Map(
      schema.sectors.map((section) => {
        let labelStyle = section.labelStyle;
        if (typeof labelStyle === 'string') {
          try {
            labelStyle = JSON.parse(labelStyle) as ISector['labelStyle'];
          } catch {
            labelStyle = undefined;
          }
        }
        return [section.id, { ...section, labelStyle }];
      }),
    );
    this.cart = { seats: [], ga: [] };
    this.selectedSeats.clear();
    this.selectedSections.clear();
    this.selectedGa = undefined;
    const explicit = svgOutlines(schema.background.outlineSvg ?? undefined, this.getSections());
    const background = svgOutlines(schema.background.svg ?? undefined, this.getSections());
    this.outlines = [
      ...explicit,
      ...background.filter((o) => !explicit.some((e) => e.id.split(':')[0] === o.id.split(':')[0])),
    ];
    this.outlines.push(
      ...fallbackOutlines([...this.seats.values()], this.getSections(), this.outlines),
    );
    this.refresh();
  }

  protected installPrices(prices: IPriceListDTO): void {
    this.priceList = structuredClone(prices);
    this.prices = priceLegend(this.priceList.prices, this.settings.theme?.priceColors);
    for (const seat of this.seats.values()) {
      delete seat.priceId;
      delete seat.special;
    }
    for (const [id, price, special] of prices.seats) {
      const seat = this.seats.get(id);
      if (seat) Object.assign(seat, { priceId: price, special });
    }
    for (const section of this.sections.values()) {
      delete section.priceId;
      delete section.special;
      Reflect.deleteProperty(section, 'color');
    }
    for (const [id, price, , special] of prices.groupOfSeats) {
      const section = this.sections.get(id);
      if (section) Object.assign(section, { priceId: price, special });
    }
    for (const seat of this.seats.values()) {
      Object.assign(seat, { color: this.prices.find((p) => p.id === seat.priceId)?.color });
      seat.locked = this.settings.lockedSeatsFilter?.(seat) ?? !seat.priceId;
    }
    for (const section of this.sections.values())
      Object.assign(section, { color: this.prices.find((p) => p.id === section.priceId)?.color });
    this.invalidateSeats();
    this.invalidateSections();
    this.refresh();
  }

  protected key(seat: ISeat): string {
    return `${this.sections.get(seat.sectorId)?.name ?? ''};;${this.rows.get(seat.rowId)?.rowNumber ?? ''};;${seat.name}`;
  }
  protected price(seat: ISeat): number | undefined {
    const label = this.prices.find((p) => String(p.id) === String(Number(seat.priceId)))?.name;
    if (!label?.trim()) return undefined;
    const price = parseFloat(label);
    return Number.isFinite(price) ? price : undefined;
  }
  protected available(seat: ISeat): boolean {
    const style = this.settings.theme?.seatStyles?.[seat.customState ?? ''];
    return (
      seat.priceId !== undefined &&
      !seat.locked &&
      !seat.filtered &&
      !(style && 'blockInteraction' in style && style.blockInteraction)
    );
  }
  protected invalidateSeats(): void {}
  protected invalidateSections(): void {}

  private rowLabel(id: number): string | undefined {
    const row = this.rows.get(id);
    return row?.name && row.name !== 'Row' ? row.name : row?.rowNumber?.toString();
  }

  protected refresh(): void {
    if (this.destroyed) return;
    const inCart = new Set(this.cart.seats.map((seat) => seat.id));
    const data: SeatmapData = {
      seats: this.settings.hideSeats
        ? []
        : [...this.seats.values()].map((seat) => ({
            id: seat.id,
            x: seat.x,
            y: seat.y,
            label: seat.name,
            row: this.rowLabel(seat.rowId),
            section: this.sections.get(seat.sectorId)?.name,
            category: this.prices.some((price) => price.id === seat.priceId)
              ? String(seat.priceId)
              : undefined,
            accessible: seat.isAccessible,
            status: this.available(seat) || inCart.has(seat.id) ? 'available' : 'unavailable',
          })),
      categories: this.prices.map((p) => ({ id: String(p.id), label: p.name, color: p.color })),
      outlines: this.outlines.map((outline) => {
        const section = this.sections.get(Number(outline.id.split(':')[0]));
        const selected = this.selectedSections.has(section?.id ?? -1),
          highlighted = this.highlightedSection === section?.id;
        const style = this.settings.theme?.svgSectionStyles;
        const state = section?.disabled
          ? style?.unavailable
          : section?.filtered
            ? style?.filtered
            : selected
              ? style?.selected
              : highlighted
                ? style?.hovered
                : style?.default;
        return {
          ...outline,
          interactive: !section?.disabled && !section?.filtered,
          fill:
            state?.bgColor ?? (selected ? '#4597d530' : highlighted ? '#4597d518' : outline.fill),
          stroke:
            state?.stroke?.color ??
            (selected || highlighted || this.settings.highlightAllOutlines
              ? '#4597d5'
              : outline.stroke),
          strokeWidth: state?.stroke?.width ? parseFloat(state.stroke.width) : 1,
        };
      }),
    };
    const bg = this.schema?.background;
    const withBackground: SeatmapData =
      bg && (bg.svg || bg.svgLink)
        ? {
            ...data,
            background: bg.svg
              ? { svg: bg.svg, bounds: bg.viewBox }
              : { url: bg.svgLink!, bounds: bg.viewBox },
          }
        : data;
    this.client.setData(withBackground);
    this.client.clear();
    for (const seat of this.cart.seats) if (seat.id !== undefined) this.client.select(seat.id);
  }

  getSeats(): ISeatDTO[] {
    return [...this.seats.values()].sort((a, b) => a.id - b.id).map((seat) => ({ ...seat }));
  }
  getRows(): IRowDTO[] {
    return [...this.rows.values()].sort((a, b) => a.id - b.id).map((row) => ({ ...row }));
  }
  getRowById(id: number): IRowDTO | undefined {
    const row = this.rows.get(id);
    return row ? { ...row } : undefined;
  }
  getSections(): ISector[] {
    return [...this.sections.values()]
      .sort((a, b) => a.id - b.id)
      .map((section) => ({ ...section }));
  }
  getSectionsKeys(): (number | string)[] {
    return [...this.sections.keys()].sort((a, b) => a - b).map(String);
  }
  getMarkedSeatsIds(): number[] {
    return [...this.seats.values()].filter((s) => s.isMarked).map((s) => s.id);
  }
  getSeatIds(seats: ISeat[] | number[] | string[]): number[] {
    if (!seats.length) return [];
    if (typeof seats[0] === 'number') return seats as number[];
    if (typeof seats[0] === 'string') return this.seatKeysToIds(seats as string[]);
    return (seats as ISeat[]).map((seat) => seat.id);
  }
  seatKeysToIds(keys: string[]): number[] {
    const byKey = new Map([...this.seats.values()].map((s) => [this.key(s), s.id]));
    return keys.flatMap((key) => {
      const id = byKey.get(key);
      return id === undefined ? [] : [id];
    });
  }
  getVisibleSeats(): ISeat[] {
    const view = this.canvas.getViewport(),
      size = this.canvas.getSize();
    return [...this.seats.values()].flatMap((seat) => {
      const p = view.toScreen(seat);
      return p.x >= 0 && p.y >= 0 && p.x <= size.width && p.y <= size.height
        ? [{ ...seat, ...p }]
        : [];
    });
  }
  getPrices(): IColoredPrice[] {
    return this.prices.map((p) => ({ ...p }));
  }
  getCategoryColor(category: number | string): string | undefined {
    return (
      this.categoryColors.get(category) ??
      (typeof category === 'number'
        ? this.settings.theme?.colorCategories?.[
            category % this.settings.theme.colorCategories.length
          ]
        : undefined)
    );
  }
  setExternalPrices(seatsPrices?: ISeatPriceScheme[]): void {
    const external = seatsPrices ?? this.settings.seatsPrices;
    if (!external?.length || !this.schema) return;
    const prices = new Map(
      external.map((p) => [p.priceId, { id: p.priceId, name: String(p.price) }]),
    );
    const byKey = new Map([...this.seats.values()].map((s) => [this.key(s), s.id]));
    const seats: IPriceListDTO['seats'] = external.flatMap((p) => {
      const id =
        p.id !== undefined ? (this.seats.has(p.id) ? p.id : undefined) : byKey.get(p.seatKey);
      return id === undefined ? [] : [[id, p.priceId]];
    });
    if (seats.length)
      this.installPrices({ ...this.priceList, prices: [...prices.values()], seats });
  }
  seatToExtendedSeat = (seat: ISeat): IExtendedSeat => {
    const screen = this.canvas.getViewport().toScreen(seat);
    return {
      id: seat.id,
      key: this.key(seat),
      price: this.price(seat),
      special: seat.special,
      x: Math.round(screen.x),
      y: Math.round(screen.y),
      ax: seat.x,
      ay: seat.y,
      sectionId: seat.sectorId,
      sectorId: seat.sectorId,
      seatName: seat.name,
      rowNumber: this.rows.get(seat.rowId)?.rowNumber ?? 0,
      sectionName: this.sections.get(seat.sectorId)?.name ?? '',
    };
  };
  protected sectionView(id: number): ISection | undefined {
    const section = this.sections.get(id);
    if (!section) return undefined;
    const bounds = this.sectionBounds(id),
      view = this.canvas.getViewport(),
      p = view.toScreen(bounds);
    return {
      id,
      name: section.name,
      ga: section.isGa,
      rect: {
        left: p.x,
        top: p.y,
        width: bounds.width * view.scale,
        height: bounds.height * view.scale,
      },
      priceId: section.priceId,
      price: this.prices
        .map((p) => ({ ...p, amount: parseFloat(p.name) }))
        .find((p) => p.id === section.priceId)?.amount,
      special: section.special,
      type: section.type,
      photos: section.photos,
      seatCount: [...this.seats.values()].filter((s) => s.sectorId === id).length || undefined,
    };
  }
  protected sectionBounds(id: number) {
    const bounds = this.outlines.filter((o) => o.id.startsWith(`${id}:`)).map((o) => o.bounds);
    return pointBounds(bounds.flatMap((b) => [b, { x: b.x + b.width, y: b.y + b.height }]));
  }
  getSectionsWithCoords(): ISectionWithCoords[] {
    const locations: ISectionWithCoords[] = [];
    for (const { id } of this.getSections()) {
      const view = this.sectionView(id);
      if (view) {
        const { left, top, width, height } = view.rect;
        const center = { x: Math.round(left + width * 0.5), y: Math.round(top + height * 0.5) };
        locations.push({ ...view, ...center });
      }
    }
    return locations;
  }
}
