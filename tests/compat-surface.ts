import type { SeatmapBookingRenderer, ICart } from '@seatmap.pro/renderer-ce';

const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export async function surface(renderer: SeatmapBookingRenderer) {
  const results: Record<string, unknown> = {};
  const snapshot = (name: string, value: unknown) => {
    results[name] = JSON.parse(JSON.stringify(value ?? null)) as unknown;
  };
  const metadata = (
    section: ReturnType<ReturnType<SeatmapBookingRenderer['getDataManager']>['getSectionMetadata']>,
  ) =>
    section && {
      ...section,
      bounds: section.bounds && {
        x: section.bounds.x,
        y: section.bounds.y,
        width: section.bounds.width,
        height: section.bounds.height,
      },
    };
  const seats = () => renderer.getSeats();
  const sections = () => renderer.getSections();
  const cart = (name: string, result?: unknown) =>
    snapshot(name, { result, cart: renderer.getCart() });
  const data = renderer.getDataManager();
  snapshot('getSeats', seats());
  snapshot('getRows', renderer.getRows());
  snapshot('getRowById', [renderer.getRowById(5), renderer.getRowById(-1)]);
  snapshot('getSections', sections());
  snapshot('getSectionsKeys', renderer.getSectionsKeys());
  snapshot('getMarkedSeatsIds', renderer.getMarkedSeatsIds());
  snapshot('getSeatIds', [
    renderer.getSeatIds([10, 10, -1]),
    renderer.getSeatIds(seats()),
    renderer.getSeatIds(['Stalls;;1;;2', 'missing']),
  ]);
  snapshot('seatKeysToIds', renderer.seatKeysToIds(['Stalls;;1;;1', 'missing', 'Stalls;;1;;1']));
  snapshot('getPrices', renderer.getPrices());
  snapshot('seatToExtendedSeat', renderer.seatToExtendedSeat(seats()[0]!));
  snapshot(
    'getVisibleSeats',
    renderer
      .getVisibleSeats()
      .map((s) => ({ id: s.id, x: s.x, y: s.y }))
      .sort((a, b) => a.id - b.id),
  );
  snapshot('getSectionsWithCoords', renderer.getSectionsWithCoords());
  const held: ICart = {
    seats: [
      { id: 10, key: '', price: 42.5 },
      { id: 13, key: '', price: 42.5 },
    ],
    ga: [],
  };
  cart('initCart', renderer.initCart(held));
  cart(
    'addSeatsToCart',
    renderer.addSeatsToCart([{ key: 'Stalls;;1;;2' }, { id: 10, key: '' }, { id: -1, key: '' }]),
  );
  cart('removeSeatsFromCartByIds', renderer.removeSeatsFromCartByIds([10]));
  cart('removeSeatsFromCartByKeys', renderer.removeSeatsFromCartByKeys(['Stalls;;1;;2']));
  renderer.clearCart();
  cart('clearCart');
  renderer.addGaToCart({ key: 'Floor', count: 2, price: 20 });
  cart('addGaToCart');
  renderer.addGaToCart({ sectorId: 21, key: '', count: 1 });
  cart('addGaToCartAgain');
  renderer.removeGaFromCart({ sectorId: 21, price: 99 });
  cart('removeGaMismatch');
  renderer.removeGaFromCart({ sectorId: 21 });
  cart('removeGaFromCart');
  renderer.disableSeatsByIds([10]);
  snapshot('disableSeatsByIds', seats());
  renderer.disableSeatsByIds([11], { resetAll: false });
  snapshot('disableSeatsWithoutReset', seats());
  renderer.enableSeatsByIds([10, 11]);
  snapshot('enableSeatsByIds', seats());
  renderer.disableSeatsByKeys(['Stalls;;1;;3']);
  snapshot('disableSeatsByKeys', seats());
  renderer.updateSeatLocks((s) => s.id === 13);
  snapshot('updateSeatLocks', seats());
  renderer.filterSeatsByIds([10, 11]);
  snapshot('filterSeatsByIds', seats());
  renderer.filterSeatsByKeys(['Stalls;;1;;3']);
  snapshot('filterSeatsByKeys', seats());
  renderer.removeFilter([10, 12]);
  snapshot('removeFilterSubset', seats());
  renderer.removeFilter();
  snapshot('removeFilter', seats());
  renderer.setSeatsCategory([10], 'vip', '#112233');
  snapshot('setSeatsCategory', seats());
  snapshot('getCategoryColor', renderer.getCategoryColor('vip'));
  renderer.setSeatsCategory(['Stalls;;1;;2'], 2, '#abcdef');
  snapshot('numericCategory', seats());
  renderer.clearSeatsCategory([10]);
  snapshot('clearSeatsCategory', seats());
  renderer.resetSeatsCategories();
  snapshot('resetSeatsCategories', seats());
  renderer.setGaCategory([21], 'vip', '#123456');
  snapshot('setGaCategory', sections());
  renderer.clearGaCategory(['Floor']);
  snapshot('clearGaCategory', sections());
  renderer.setGaCategory([21], 2);
  renderer.resetGaCategories();
  snapshot('resetGaCategories', sections());
  renderer.setSeatsCategory([10], 2);
  renderer.setGaCategory([21], 3);
  renderer.resetCategories();
  snapshot('resetCategories', { seats: seats(), sections: sections() });
  renderer.setSeatsState([10, -1], 'reserved');
  snapshot('setSeatsState', seats());
  cart('blockedCustomState', renderer.addSeatsToCart([{ id: 10, key: '' }]));
  renderer.clearSeatsState([10]);
  snapshot('clearSeatsState', seats());
  renderer.setSeatSelection([12, 10]);
  snapshot('getSeatSelection', renderer.getSeatSelection());
  renderer.setSectionSelection(['Stalls']);
  snapshot('getSvgSectionBySelection', renderer.getSvgSectionBySelection());
  renderer.setSelectedGa('Floor');
  snapshot('getSelectedGa', { ga: renderer.getSelectedGa(), seats: renderer.getSeatSelection() });
  renderer.setSelectedGa();
  renderer.setSectionSelection();
  renderer.disableSvgSectionsByIds([20]);
  snapshot('disableSvgSectionsByIds', sections());
  renderer.enableSvgSectionsByIds([20]);
  snapshot('enableSvgSectionsByIds', sections());
  renderer.disableSvgSectionsByNames(['Floor'], { resetAll: true });
  snapshot('disableSvgSectionsByNames', sections());
  renderer.enableSvgSectionsByNames(['Floor']);
  snapshot('enableSvgSectionsByNames', sections());
  renderer.disableSectionsByIds([21]);
  snapshot('disableSectionsByIds', sections());
  renderer.enableSectionsByIds();
  snapshot('enableSectionsByIds', sections());
  renderer.filterSvgSectionsByIds([20]);
  snapshot('filterSvgSectionsByIds', sections());
  renderer.removeFilterSvgSectionsByIds([21]);
  snapshot('removeFilterSvgSectionsByIds', sections());
  renderer.disableSections([20]);
  snapshot('disableSections', sections());
  renderer.enableSections([20]);
  snapshot('enableSections', sections());
  renderer.filterSections([21], { resetAll: true });
  snapshot('filterSections', sections());
  renderer.removeFilterSections();
  snapshot('removeFilterSections', sections());
  renderer.disableSectionsByNames(['Stalls']);
  snapshot('disableSectionsByNames', sections());
  renderer.enableSectionsByNames(['Stalls']);
  snapshot('enableSectionsByNames', sections());
  renderer.highlightSector(20);
  data.invalidateSection(20);
  snapshot('highlightSector', data.getSectionMetadata(20)?.states);
  renderer.clearSectorHighlight();
  data.invalidateSections();
  snapshot('clearSectorHighlight', data.getSectionMetadata(20)?.states);
  renderer.setHighlightAllOutlines(true);
  snapshot('getHighlightAllOutlines', renderer.getHighlightAllOutlines());
  renderer.setHighlightAllOutlines(false);
  renderer.setHeight(300);
  await frame();
  snapshot('size', [renderer.getWidth(), renderer.getHeight()]);
  renderer.zoomToFit();
  await frame();
  snapshot('zoomToFit', renderer.getZoom());
  snapshot('zoomLimits', [renderer.getMinZoom(), renderer.getMaxZoom()]);
  renderer.zoomOut();
  await frame();
  snapshot('zoomOut', renderer.getZoom());
  renderer.zoomIn();
  await frame();
  snapshot('zoomIn', renderer.getZoom());
  renderer.zoomTo(0.75, { destination: { x: 80, y: 50 }, durationMs: 0 });
  await frame();
  snapshot('zoomTo', renderer.getZoom());
  renderer.zoomToDestination(window.devicePixelRatio, { x: 0, y: 0 }, 0);
  await frame();
  snapshot('zoomToDestination', renderer.getZoom());
  renderer.zoomToSection(20, { mode: 'scale', scale: 0.8, focus: true });
  await frame();
  snapshot('zoomToSection', renderer.getZoom());
  renderer.viewSection(renderer.getSectionsWithCoords()[0]!);
  await frame();
  snapshot('viewSection', renderer.getZoom());
  snapshot('getVersion', typeof renderer.getVersion());
  data.refresh();
  snapshot('getSeatMetadata', [data.getSeatMetadata(10), data.getSeatMetadata(-1)]);
  snapshot('getAllSeatMetadata', data.getAllSeatMetadata(20));
  snapshot('getSectionMetadata', metadata(data.getSectionMetadata(20)));
  snapshot('getAllSectionMetadata', data.getAllSectionMetadata().map(metadata));
  const events: (number | undefined)[] = [];
  const listener = (id?: number) => events.push(id);
  for (const name of ['seatsChanged', 'sectionsChanged', 'dataInvalidated', 'dataLoaded'] as const)
    data.on(name, listener);
  data.invalidateSeat(10);
  data.invalidateSeats();
  data.invalidateSection(20);
  data.invalidateSections();
  data.invalidateAll();
  data.notifyDataLoaded();
  for (const name of ['seatsChanged', 'sectionsChanged', 'dataInvalidated', 'dataLoaded'] as const)
    data.off(name, listener);
  data.invalidateAll();
  snapshot('dataEvents', events);
  renderer.setExternalPrices([
    { id: 10, seatKey: '', priceId: 7, price: 33.5 },
    { seatKey: 'Stalls;;1;;2', priceId: 8, price: 12 },
  ]);
  snapshot('setExternalPrices', { seats: seats(), prices: renderer.getPrices() });
  data.destroy();
  return results;
}
