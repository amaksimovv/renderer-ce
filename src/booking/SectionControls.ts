import type { ISectorDTO } from './api-types.js';
import { CartControls } from './CartControls.js';
import type { ISeat, ISector, IExtendedSeat } from './models.js';

export class SectionControls extends CartControls {
  private originalSectionPrices = new Map<number, string | number>();
  setSeatsCategory(
    seats: ISeat[] | number[] | string[],
    category: number | string,
    color?: string,
  ): void {
    if (color !== undefined) this.categoryColors.set(category, color);
    for (const id of this.getSeatIds(seats)) {
      const seat = this.seats.get(id);
      if (seat) this.assignCategory(seat, category);
    }
    this.refresh();
  }
  private assignCategory(seat: ISeat, value?: string | number): void {
    if (typeof value === 'number') seat.special = { ...seat.special, category: value };
    else if (seat.special) delete seat.special.category;
    if (typeof value === 'string') seat.categoryKey = value;
    else delete seat.categoryKey;
  }
  setGaCategory(
    sections: ISector[] | number[] | string[],
    category: number | string | undefined,
    color?: string,
  ): void {
    if (category !== undefined && color !== undefined) this.categoryColors.set(category, color);
    for (const id of this.sectionIds(sections)) {
      if (category === undefined) this.gaCategories.delete(id);
      else this.gaCategories.set(id, category);
    }
    this.refresh();
  }
  clearSeatsCategory(seats: ISeat[] | number[] | string[]): void {
    for (const id of this.getSeatIds(seats)) {
      const seat = this.seats.get(id);
      if (seat) this.assignCategory(seat);
    }
    this.refresh();
  }
  clearGaCategory(sections: ISector[] | number[] | string[]): void {
    this.setGaCategory(sections, undefined);
  }
  resetSeatsCategories(): void {
    this.clearSeatsCategory([...this.seats.keys()]);
  }
  resetGaCategories(): void {
    this.gaCategories.clear();
    this.refresh();
  }
  resetCategories(): void {
    this.categoryColors.clear();
    this.resetSeatsCategories();
    this.resetGaCategories();
  }
  setSeatsState(seats: ISeat[] | number[] | string[], stateKey: string): void {
    for (const id of this.getSeatIds(seats)) {
      const seat = this.seats.get(id);
      if (seat) seat.customState = stateKey;
    }
    this.refresh();
  }
  clearSeatsState(seats: ISeat[] | number[] | string[]): void {
    for (const id of this.getSeatIds(seats)) {
      const seat = this.seats.get(id);
      if (seat) delete seat.customState;
    }
    this.refresh();
  }
  getSeatSelection(): IExtendedSeat[] {
    return [...this.selectedSeats].flatMap((id) => {
      const seat = this.seats.get(id);
      return seat ? [this.seatToExtendedSeat(seat)] : [];
    });
  }
  setSeatSelection(seats: ISeat[] | number[] | string[]): void {
    this.selectedSeats = new Set(this.getSeatIds(seats));
    this.selectedGa = undefined;
    const selected = this.getSeats().filter((s) => this.selectedSeats.has(s.id));
    this.settings.onSeatsSelectionChange?.(selected);
    this.settings.onSeatsSelect?.(selected);
    this.canvas.redraw();
  }
  protected sectionIds(sections: ISector[] | number[] | string[]): number[] {
    return sections.flatMap((item) => {
      const id =
        typeof item === 'number'
          ? item
          : typeof item === 'string'
            ? this.getSections().find((s) => s.name === item)?.id
            : item.id;
      return id !== undefined && this.sections.has(id) ? [id] : [];
    });
  }
  setSectionSelection(sections?: number[] | string[]): void {
    this.selectedSections = new Set(this.sectionIds(sections ?? []));
    for (const section of this.sections.values())
      section.selected = this.selectedSections.has(section.id);
    this.invalidateSections();
    this.refresh();
  }
  getSvgSectionBySelection(): ISectorDTO[] {
    return this.getSections().filter((s) => this.selectedSections.has(s.id));
  }
  setSelectedGa(ga?: number | string): void {
    const section =
      typeof ga === 'number'
        ? this.sections.get(ga)
        : this.getSections().find((s) => s.name === ga);
    this.selectedSeats.clear();
    this.selectedGa = typeof ga === 'number' && ga ? ga : section?.isGa ? section.id : undefined;
    this.highlightedSection = this.selectedGa;
    this.invalidateSections();
    this.refresh();
  }
  getSelectedGa(): ISector | undefined {
    const section = this.selectedGa !== undefined ? this.sections.get(this.selectedGa) : undefined;
    return section ? { ...section } : undefined;
  }
  disableSvgSectionsByIds(ids: number[], options?: { resetAll?: boolean }): void {
    if (options?.resetAll) for (const section of this.sections.values()) section.disabled = false;
    for (const id of ids) {
      const section = this.sections.get(id);
      if (section) section.disabled = true;
    }
    this.selectedGa = undefined;
    this.invalidateSections();
    this.refresh();
  }
  enableSvgSectionsByIds(ids: number[]): void {
    for (const id of ids) {
      const s = this.sections.get(id);
      if (s) {
        s.disabled = false;
        s.selected = false;
        this.selectedSections.delete(id);
      }
    }
    this.selectedGa = undefined;
    this.invalidateSections();
    this.refresh();
  }
  disableSvgSectionsByNames(names: string[], options?: { resetAll?: boolean }): void {
    this.disableSvgSectionsByIds(this.sectionIds(names), options);
  }
  enableSvgSectionsByNames(names: string[]): void {
    this.enableSvgSectionsByIds(this.sectionIds(names));
  }
  disableSectionsByIds(ids: number[]): void {
    for (const id of ids.filter(Boolean)) {
      const section = this.sections.get(id);
      if (!section || section.priceId === undefined) continue;
      this.originalSectionPrices.set(id, section.priceId);
      section.disabled = true;
      delete section.priceId;
      section.selected = false;
      this.selectedSections.delete(id);
      this.removeGaFromCart({ sectorId: id });
    }
    this.selectedGa = undefined;
    this.invalidateSections();
    this.refresh();
  }
  enableSectionsByIds(): void {
    for (const [id, priceId] of this.originalSectionPrices) {
      const section = this.sections.get(id);
      if (section) {
        section.disabled = false;
        section.priceId = priceId;
      }
    }
    this.originalSectionPrices.clear();
    this.selectedGa = undefined;
    this.invalidateSections();
    this.refresh();
  }
  filterSvgSectionsByIds(ids: number[], options?: { resetAll?: boolean }): void {
    const visible = new Set(ids);
    if (options?.resetAll)
      this.removeFilterSvgSectionsByIds(
        this.getSections()
          .filter((s) => s.filtered)
          .map((s) => s.id),
      );
    this.selectedGa = undefined;
    for (const section of this.sections.values()) section.filtered = !visible.has(section.id);
    this.invalidateSections();
    this.refresh();
  }
  removeFilterSvgSectionsByIds(ids?: number[]): void {
    for (const id of ids ?? this.sections.keys()) {
      const s = this.sections.get(id);
      if (s) {
        s.filtered = false;
        s.selected = false;
        this.selectedSections.delete(id);
      }
    }
    this.selectedGa = undefined;
    this.invalidateSections();
    this.refresh();
  }
  disableSections(ids: number[], options?: { resetAll?: boolean }): void {
    this.disableSvgSectionsByIds(ids, options);
  }
  enableSections(ids: number[]): void {
    this.enableSvgSectionsByIds(ids);
  }
  filterSections(ids: number[], options?: { resetAll?: boolean }): void {
    this.filterSvgSectionsByIds(ids, options);
  }
  removeFilterSections(ids?: number[]): void {
    this.removeFilterSvgSectionsByIds(ids);
  }
  disableSectionsByNames(names: string[], options?: { resetAll?: boolean }): void {
    this.disableSvgSectionsByNames(names, options);
  }
  enableSectionsByNames(names: string[]): void {
    this.enableSvgSectionsByNames(names);
  }
  highlightSector(id: number | undefined): void {
    this.highlightedSection = id;
    this.invalidateSections();
    this.refresh();
  }
  clearSectorHighlight(): void {
    this.highlightSector(undefined);
  }
  setHighlightAllOutlines(highlight: boolean): void {
    this.settings.highlightAllOutlines = highlight;
    this.invalidateSections();
    this.refresh();
  }
  getHighlightAllOutlines(): boolean {
    return this.settings.highlightAllOutlines ?? false;
  }
}
