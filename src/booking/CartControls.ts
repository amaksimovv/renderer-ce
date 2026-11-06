import { SeatNeighbours } from './SeatNeighbours.js';
import { RendererState } from './RendererState.js';
import type {
  ICart,
  ICartSeat,
  ICartGa,
  IRemovedCartGa,
  ICartChangeResult,
  SeatFilter,
} from './models.js';

const result = (applied: boolean, orphaned: number[] = []): ICartChangeResult => ({
  applied,
  orphaned,
  remedy: orphaned.length ? { select: orphaned, deselect: [] } : null,
});
export class CartControls extends RendererState {
  private neighbours?: SeatNeighbours;
  private pending = new Map<number, number>();
  private seatRevisions = new Map<number, number>();
  getCart(): ICart {
    return JSON.parse(JSON.stringify(this.cart)) as ICart;
  }
  initCart(cart: ICart): ICartChangeResult {
    this.revision++;
    return this.commitCart(
      {
        seats: this.repairSeats(cart.seats),
        ga: cart.ga.flatMap((ga) => {
          const repaired = this.repairGa(ga);
          return repaired ? [repaired] : [];
        }),
      },
      true,
      true,
    );
  }
  clearCart(): void {
    this.revision++;
    this.commitCart({ seats: [], ga: [] }, false);
  }
  addSeatsToCart(seats: ICartSeat[]): ICartChangeResult {
    return this.commitCart({
      ...this.cart,
      seats: [...this.cart.seats, ...this.repairSeats(seats).filter((s) => !this.blocked(s.id!))],
    });
  }
  removeSeatsFromCartByIds(ids: number[]): ICartChangeResult {
    const removed = new Set(ids);
    return this.commitCart(
      {
        ...this.cart,
        seats: this.cart.seats.filter((s) => !removed.has(s.id!)),
      },
      true,
      false,
      true,
    );
  }
  removeSeatsFromCartByKeys(keys: string[]): ICartChangeResult {
    return this.removeSeatsFromCartByIds(this.seatKeysToIds(keys));
  }
  addGaToCart(ga: ICartGa): void {
    const item = this.repairGa(ga);
    if (!item) return;
    const previous = this.getCart();
    const next = this.getCart(),
      stored = next.ga.find((g) => g.sectorId === item.sectorId);
    if (stored) {
      stored.count += item.count;
      stored.price = item.price ?? stored.price;
    } else next.ga.push(item);
    if (this.commitCart(next, false).applied)
      this.settings.onCartChange?.(this.getCart(), previous);
  }
  removeGaFromCart(removed: IRemovedCartGa): void {
    const item = this.cart.ga.find((g) => g.sectorId === removed.sectorId);
    if (
      !item ||
      (removed.price &&
        Number.isFinite(removed.price) &&
        Number.isFinite(item.price) &&
        item.price !== removed.price)
    )
      return;
    const previous = this.getCart();
    this.commitCart({ ...this.cart, ga: this.cart.ga.filter((g) => g !== item) }, false);
    this.settings.onCartChange?.(this.getCart(), previous);
  }
  private repairGa(ga: ICartGa): ICartGa | undefined {
    const section = ga.sectorId
      ? this.sections.get(ga.sectorId)
      : this.getSections().find((s) => s.name === ga.key);
    if (!section || !ga.count) return undefined;
    return { sectorId: section.id, key: section.name, count: ga.count, price: ga.price };
  }
  private repairSeats(items: ICartSeat[]): ICartSeat[] {
    const byKey = new Map([...this.seats.values()].map((seat) => [this.key(seat), seat]));
    return items.flatMap((item) => {
      const seat = item.id ? this.seats.get(item.id) : byKey.get(item.key);
      return seat
        ? [
            {
              id: seat.id,
              key: this.key(seat),
              price: item.price !== undefined ? item.price : this.price(seat),
              special: item.special || seat.special,
            },
          ]
        : [];
    });
  }
  private blocked(id: number): boolean {
    const key = this.seats.get(id)?.customState;
    const style = key ? this.settings.theme?.seatStyles?.[key] : undefined;
    return !!style && 'blockInteraction' in style && !!style.blockInteraction;
  }
  protected commitCart(
    next: ICart,
    checkOrphans = true,
    restoring = false,
    force = false,
  ): ICartChangeResult {
    if (this.destroyed) return result(false);
    const beforeIds = restoring
      ? []
      : this.cart.seats.flatMap((s) => (s.id === undefined ? [] : [s.id]));
    const afterIds = next.seats.flatMap((s) => (s.id === undefined ? [] : [s.id]));
    const removed = beforeIds.filter((id) => !afterIds.includes(id));
    const change = removed.length
      ? { type: 'deselect' as const, ids: removed }
      : { type: 'select' as const, ids: afterIds.filter((id) => !beforeIds.includes(id)) };
    const check = checkOrphans
      ? this.checkChange(change.type, change.ids, beforeIds)
      : result(true);
    if (!check.applied && !restoring && !force) return check;
    const previous = this.getCart();
    this.cart = structuredClone(next);
    for (const item of this.cart.seats) {
      const seat = this.seats.get(item.id!);
      if (!seat || seat.priceId || !item.price) continue;
      const prices = this.prices.filter((p) => parseFloat(p.name) === item.price);
      if (prices.length === 1) seat.priceId = prices[0]!.id;
      if (item.special && !seat.special) seat.special = item.special;
    }
    for (const item of this.cart.ga) {
      const section = this.sections.get(item.sectorId!);
      if (!section || section.priceId || !item.price) continue;
      const prices = this.prices.filter((p) => parseFloat(p.name) === item.price);
      if (prices.length === 1) section.priceId = prices[0]!.id;
    }
    const before = new Set(previous.seats.map((seat) => seat.id));
    const after = new Set(next.seats.map((seat) => seat.id));
    for (const id of new Set([...before, ...after]))
      if (id !== undefined && before.has(id) !== after.has(id))
        this.seatRevisions.set(id, (this.seatRevisions.get(id) ?? 0) + 1);
    if (restoring) this.refresh();
    this.client.clear();
    for (const seat of this.cart.seats) if (seat.id !== undefined) this.client.select(seat.id);
    if (restoring) this.settings.onCartChange?.(this.getCart());

    return { ...check, applied: true };
  }
  private checkChange(
    type: 'select' | 'deselect',
    ids: number[],
    cart: number[],
  ): ICartChangeResult {
    if (!ids.length || !(this.settings.orphanPrevention ?? this.priceList.orphanPrevention ?? true))
      return result(true);
    if (this.neighbours?.seats !== this.seats) this.neighbours = new SeatNeighbours(this.seats);
    return this.neighbours.check(type === 'select', ids, cart, (id) => this.blocked(id));
  }
  protected async activateSeat(id: number): Promise<void> {
    const seat = this.seats.get(id);
    if (
      !seat ||
      this.destroyed ||
      this.loading ||
      this.settings.disableCartInteractions ||
      this.pending.get(id) === this.revision ||
      !this.available(seat)
    )
      return;
    if (
      !this.cart.seats.some((s) => s.id === id) &&
      this.settings.selectionLimit &&
      this.cart.seats.length >= this.settings.selectionLimit
    )
      return;
    const revision = this.revision,
      selected = this.cart.seats.some((s) => s.id === id);
    const seatRevision = this.seatRevisions.get(id) ?? 0;
    const callback = selected ? this.settings.onSeatDeselect : this.settings.onSeatSelect;
    this.pending.set(id, revision);
    try {
      const accepted = await callback?.(this.seatToExtendedSeat(seat));
      if (
        accepted === false ||
        this.destroyed ||
        revision !== this.revision ||
        seatRevision !== (this.seatRevisions.get(id) ?? 0) ||
        !this.available(seat)
      )
        return;
      const previous = this.getCart();
      let change = selected
        ? this.removeSeatsFromCartByIds([id])
        : this.addSeatsToCart([{ id, key: this.key(seat) }]);
      if (!change.applied && change.orphaned.length && this.settings.onOrphanSeatsBlocked) {
        const approved = await this.settings.onOrphanSeatsBlocked({
          attempted: [id],
          orphaned: change.orphaned,
          remedy: change.remedy,
        });
        if (
          approved &&
          !this.destroyed &&
          revision === this.revision &&
          seatRevision === (this.seatRevisions.get(id) ?? 0)
        ) {
          const next = this.getCart();
          next.seats = selected
            ? next.seats.filter((s) => s.id !== id)
            : [...next.seats, ...this.repairSeats([{ id, key: this.key(seat) }])];
          change = this.commitCart(next, false);
        }
      }
      if (change.applied) this.settings.onCartChange?.(this.getCart(), previous);
    } catch {
      this.canvas.element.dispatchEvent(
        new CustomEvent('seatmap:selection-error', { detail: { seatId: id } }),
      );
    } finally {
      if (this.pending.get(id) === revision) this.pending.delete(id);
    }
  }
  disableSeatsByIds(ids: number[], options?: { resetAll?: boolean }): void {
    const previous = this.getCart();
    if (options?.resetAll !== false)
      for (const seat of this.seats.values())
        if (!this.prices.length || seat.priceId) seat.locked = false;
    for (const id of ids) {
      const seat = this.seats.get(id);
      if (seat) seat.locked = true;
    }
    this.commitCart(
      { ...this.cart, seats: this.cart.seats.filter((s) => !ids.includes(s.id!)) },
      false,
    );
    this.invalidateSeats();
    this.refresh();
    if (JSON.stringify(previous) !== JSON.stringify(this.getCart()))
      this.settings.onCartChange?.(this.getCart(), previous);
  }
  enableSeatsByIds(ids: number[]): void {
    for (const id of ids) {
      const seat = this.seats.get(id);
      if (seat) seat.locked = false;
    }
    this.invalidateSeats();
    this.refresh();
  }
  disableSeatsByKeys(keys: string[]): void {
    this.disableSeatsByIds(this.seatKeysToIds(keys));
  }
  filterSeatsByIds(ids: number[]): void {
    const visible = new Set(ids);
    for (const seat of this.seats.values())
      if (!!seat.filtered !== !visible.has(seat.id)) seat.filtered = !visible.has(seat.id);
    this.invalidateSeats();
    this.refresh();
  }
  filterSeatsByKeys(keys: string[]): void {
    this.filterSeatsByIds(this.seatKeysToIds(keys));
  }
  removeFilter(ids?: number[]): void {
    const visible = ids ? new Set(ids) : undefined;
    for (const seat of this.seats.values()) {
      const filtered = visible ? !visible.has(seat.id) : false;
      if (!!seat.filtered !== filtered) seat.filtered = filtered;
    }
    this.invalidateSeats();
    this.refresh();
  }
  updateSeatLocks(filter: SeatFilter): void {
    for (const seat of this.seats.values()) seat.locked = filter(seat);
    this.invalidateSeats();
    this.refresh();
  }
  protected reconcile(): void {
    this.commitCart(
      {
        ...this.cart,
        seats: this.cart.seats.filter((item) => {
          const seat = this.seats.get(item.id!);
          return seat && this.available(seat);
        }),
      },
      false,
    );
    this.invalidateSeats();
    this.refresh();
  }
  setGroupSize(groupSize: number): void {
    if (!Number.isSafeInteger(groupSize) || groupSize < 1)
      throw new RangeError('groupSize must be positive');
    this.settings.groupSize = groupSize;
  }
}
