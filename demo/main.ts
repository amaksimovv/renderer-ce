import { SeatmapBookingRenderer } from '../src';
import type { ICart, ISeat, IExtendedSeat } from '../src';
import { descriptions, venueData } from './data';
import './style.css';
import './booking.css';
import './states.css';
import './responsive.css';

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing demo element: ${selector}`);
  return result;
}
const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const feedback = element('#feedback'),
  map = element('#seatmap'),
  list = element('#seat-list'),
  cartItems = element('#cart-items'),
  selectionFeedback = element('#selection-feedback'),
  summary = element<HTMLAnchorElement>('#selection-summary');
const listButtons = new Map<number, HTMLButtonElement>();
let currentVenue = 'theatre',
  loadRevision = 0,
  requestedVenue = 'theatre',
  loadingVenue = true,
  mapVisible = false,
  cartVisible = false,
  selectionCount = 0;
let seats = new Map<number, ISeat>();
const renderer = new SeatmapBookingRenderer(map, {
  zoomAnimationDuration: 400,
  forceSvg: true,
  onRedrawEnd: () => {
    syncZoom();
  },
  selectionLimit: 6,
  orphanPrevention: false,
  theme: { bgColor: '#f5f3ed', priceColors: [['#96743a', '#4c7a6d', '#757b9d']] },
  onSeatMouseEnter: describe,
  onSeatMouseLeave: () => describe(),
  onCartChange: update,
  onSeatSelect: () => {
    if (renderer.getCart().seats.length >= 6) {
      selectionFeedback.textContent = 'Choose up to 6 seats. Remove one to change your selection.';
      return false;
    }
    return true;
  },
  onSectionClick: (section) => {
    element<HTMLSelectElement>('#section').value = String(section.id);
  },
  onSectorMouseEnter: (section) => {
    element('#seat-detail').textContent = `${section.name} · Click to explore this section`;
  },
});
function title(seat: ISeat): string {
  const row = renderer.getRowById(seat.rowId);
  const label = row?.name && row.name !== 'Row' ? row.name : (row?.rowNumber ?? '—');
  return `Row ${label}, seat ${seat.name}`;
}
function describe(seat?: IExtendedSeat): void {
  const raw = seat?.id !== undefined ? seats.get(seat.id) : undefined;
  element('#seat-detail').textContent =
    seat && raw
      ? `${seat.sectionName} · ${title(raw)} · ${seat.price === undefined ? 'Unavailable' : money(seat.price)}${raw.isAccessible ? ' · Accessible' : ''}`
      : currentVenue === 'barclays'
        ? 'Choose a section, then zoom in to pick a seat.'
        : 'Choose a seat to see its details.';
}
function update(cart: ICart): void {
  feedback.textContent = '';
  selectionFeedback.textContent = '';
  selectionCount = cart.seats.length;
  element('#selected-count').textContent = `${cart.seats.length} / 6`;
  element('#total').textContent = cart.seats.some((s) => s.price === undefined)
    ? 'Price on request'
    : money(cart.seats.reduce((sum, s) => sum + (s.price ?? 0), 0));
  element<HTMLButtonElement>('#export').disabled = cart.seats.length === 0;
  element('#clear').hidden = cart.seats.length === 0;
  element('#selection-summary-value').textContent =
    `${cart.seats.length} ${cart.seats.length === 1 ? 'seat' : 'seats'} · ${element('#total').textContent}`;
  syncSummary();
  const fragment = document.createDocumentFragment();
  if (!cart.seats.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-cart';
    const illustration = document.createElement('div');
    illustration.className = 'empty-seats';
    illustration.setAttribute('aria-hidden', 'true');
    illustration.append(...Array.from({ length: 9 }, () => document.createElement('span')));
    const heading = document.createElement('strong');
    heading.textContent = 'Find your place';
    const note = document.createElement('p');
    note.textContent = 'Pick up to 6 seats on the map. Your selection will appear here.';
    empty.append(illustration, heading, note);
    fragment.append(empty);
  }
  for (const item of cart.seats) {
    const seat = seats.get(item.id!);
    if (!seat) continue;
    const row = document.createElement('div');
    row.className = 'cart-item';
    const info = document.createElement('div'),
      name = document.createElement('strong'),
      detail = document.createElement('span');
    name.textContent = title(seat);
    detail.textContent = renderer.getSections().find((s) => s.id === seat.sectorId)?.name ?? 'Seat';
    info.append(name, detail);
    const price = document.createElement('span');
    price.textContent = item.price === undefined ? '—' : money(item.price);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-seat';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${title(seat)}`);
    remove.addEventListener('click', () => {
      renderer.removeSeatsFromCartByIds([seat.id]);
      update(renderer.getCart());
      (
        cartItems.querySelector<HTMLButtonElement>('button') ??
        (list.hidden
          ? map.querySelector<HTMLElement>('[role=listbox]')
          : list.querySelector<HTMLButtonElement>('button:not(:disabled)'))
      )?.focus({ preventScroll: true });
    });
    row.append(info, price, remove);
    fragment.append(row);
  }
  cartItems.replaceChildren(fragment);
  const selected = new Set(cart.seats.map((s) => s.id));
  for (const [id, button] of listButtons)
    button.setAttribute('aria-pressed', String(selected.has(id)));
}
function buildList(): void {
  listButtons.clear();
  const section = Number(element<HTMLSelectElement>('#section').value);
  let visible = [...seats.values()];
  if (section) visible = visible.filter((s) => s.sectorId === section);
  const sectionNames = new Map(renderer.getSections().map((item) => [item.id, item.name]));
  const rowNumbers = new Map(renderer.getRows().map((row) => [row.id, row.rowNumber]));
  const order = new Intl.Collator('en', { numeric: true });
  visible.sort(
    (a, b) =>
      order.compare(sectionNames.get(a.sectorId) ?? '', sectionNames.get(b.sectorId) ?? '') ||
      (rowNumbers.get(a.rowId) ?? 0) - (rowNumbers.get(b.rowId) ?? 0) ||
      order.compare(a.name, b.name) ||
      a.id - b.id,
  );
  const truncated = visible.length > 1000;
  visible = visible.slice(0, 1000);
  const metadata = new Map(
    renderer
      .getDataManager()
      .getAllSeatMetadata()
      .map((s) => [s.id, s]),
  );
  const rows = new Map<string, ISeat[]>();
  for (const seat of visible) {
    const label = `${seat.sectorId}:${seat.rowId}`;
    const group = rows.get(label) ?? [];
    group.push(seat);
    rows.set(label, group);
  }
  const fragment = document.createDocumentFragment();
  if (truncated) {
    const note = document.createElement('p');
    note.textContent = 'Showing the first 1,000 seats. Choose a section to see all its seats.';
    fragment.append(note);
  }
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No seats in this section. Choose another section to continue.';
    fragment.append(empty);
  }
  for (const group of rows.values()) {
    const fieldset = document.createElement('fieldset'),
      legend = document.createElement('legend'),
      buttons = document.createElement('div');
    const first = group[0]!;
    legend.textContent = `${metadata.get(first.id)?.sectionName} · ${title(first).split(', seat ')[0]}`;
    buttons.className = 'seat-buttons';
    for (const seat of group) {
      const meta = metadata.get(seat.id)!;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = seat.name;
      button.disabled = !meta.available;
      button.setAttribute(
        'aria-label',
        `${meta.sectionName}, ${title(seat)}${seat.isAccessible ? ', accessible' : ''}`,
      );
      button.setAttribute('aria-pressed', String(meta.inCart));
      button.addEventListener('focus', () => describe(renderer.seatToExtendedSeat(seat)));
      button.addEventListener('click', () => {
        const cart = renderer.getCart();
        if (!cart.seats.some((s) => s.id === seat.id) && cart.seats.length >= 6) {
          selectionFeedback.textContent =
            'Choose up to 6 seats. Remove one to change your selection.';
          return;
        }
        const change = cart.seats.some((s) => s.id === seat.id)
          ? renderer.removeSeatsFromCartByIds([seat.id])
          : renderer.addSeatsToCart([{ id: seat.id, key: meta.key }]);
        update(renderer.getCart());
        if (!change.applied)
          selectionFeedback.textContent =
            'Choose up to 6 seats. Remove one to change your selection.';
      });
      buttons.append(button);
      listButtons.set(seat.id, button);
    }
    fieldset.append(legend, buttons);
    fragment.append(fieldset);
  }
  list.replaceChildren(fragment);
  list.scrollTop = 0;
}
async function loadVenue(id: string): Promise<void> {
  const revision = ++loadRevision;
  requestedVenue = id;
  setVenueState('loading');
  element('#demo-title').textContent = descriptions[id]!.name;
  element('#venue-description').textContent = descriptions[id]!.description;
  try {
    const { schema, prices } = await venueData(id);
    if (revision !== loadRevision) return;
    await renderer.loadData(schema, prices);
    if (revision !== loadRevision) return;
    currentVenue = id;
    seats = new Map(renderer.getSeats().map((s) => [s.id, s]));
    element('#demo-title').textContent = descriptions[id]!.name;
    element('#venue-description').textContent = descriptions[id]!.description;
    element('#seat-count').textContent =
      `${seats.size.toLocaleString('en-US')} seats · ${renderer.getSections().length} sections`;
    const section = element<HTMLSelectElement>('#section');
    section.replaceChildren(new Option('Whole venue', ''));
    for (const item of renderer
      .getSections()
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })))
      section.append(new Option(item.name, String(item.id)));
    const legend = element('#legend');
    legend.replaceChildren();
    for (const category of renderer.getPrices()) {
      const item = document.createElement('span'),
        dot = document.createElement('i');
      dot.style.background = category.color;
      item.append(dot, money(Number(category.name)));
      legend.append(item);
    }
    const unavailable = document.createElement('span');
    unavailable.className = 'legend-unavailable';
    unavailable.append(document.createElement('i'), 'Unavailable');
    legend.append(unavailable);
    setVenueState();
    if (!list.hidden) buildList();
    update(renderer.getCart());
    describe();
  } catch {
    if (revision === loadRevision) setVenueState('error');
  }
}
function showList(show: boolean): void {
  element('.map-wrap').toggleAttribute('data-hidden', show);
  element('.map-wrap').inert = show;
  list.hidden = !show;
  element('#map-view').setAttribute('aria-pressed', String(!show));
  element('#list-view').setAttribute('aria-pressed', String(show));
  if (show) buildList();
  else syncZoom();
}
function syncZoom(): void {
  const zoom = renderer.getZoom();
  element('#zoom-level').textContent = `${Math.round(zoom * 100)}%`;
  element<HTMLButtonElement>('#zoom-in').disabled =
    loadingVenue || zoom >= renderer.getMaxZoom() - 0.001;
  element<HTMLButtonElement>('#zoom-out').disabled =
    loadingVenue || zoom <= renderer.getMinZoom() + 0.001;
}
function syncSummary(): void {
  summary.hidden = loadingVenue || !selectionCount || !mapVisible || cartVisible;
}
function setVenueState(state?: 'loading' | 'error'): void {
  loadingVenue = state !== undefined;
  const area = element('.map-area');
  if (state) area.dataset.state = state;
  else delete area.dataset.state;
  element('#venue-status').hidden = !state;
  element('#venue-content').inert = Boolean(state);
  element('#venue-content').setAttribute('aria-busy', String(state === 'loading'));
  element('#cart').inert = Boolean(state);
  element<HTMLButtonElement>('#retry-venue').hidden = state !== 'error';
  element('#venue-status-title').textContent =
    state === 'error'
      ? `Couldn't load ${descriptions[requestedVenue]!.name}`
      : `Loading ${descriptions[requestedVenue]!.name}…`;
  element('#venue-status-detail').textContent =
    state === 'error'
      ? 'Check your connection and try again, or choose another venue.'
      : 'Preparing the map and seat prices.';
  syncZoom();
  syncSummary();
}
const visibility = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.target === element('.map-area')) mapVisible = entry.isIntersecting;
    if (entry.target === element('#cart')) cartVisible = entry.isIntersecting;
  }
  syncSummary();
});
visibility.observe(element('.map-area'));
visibility.observe(element('#cart'));
summary.addEventListener('click', (event) => {
  event.preventDefault();
  element('#cart').scrollIntoView({ block: 'start' });
  element('#cart').focus({ preventScroll: true });
});
element('#retry-venue').addEventListener('click', () => {
  const revision = loadRevision + 1;
  void loadVenue(requestedVenue).then(() => {
    if (revision === loadRevision) element(loadingVenue ? '#retry-venue' : '#venue').focus();
  });
});
element('#zoom-in').addEventListener('click', () => renderer.zoomIn());
element('#zoom-out').addEventListener('click', () => renderer.zoomOut());
element('#fit').addEventListener('click', () => {
  renderer.zoomToFit();
  element<HTMLSelectElement>('#section').value = '';
});
element<HTMLSelectElement>('#section').addEventListener('change', (event) => {
  const id = (event.currentTarget as HTMLSelectElement).value;
  if (id) renderer.zoomToSection(Number(id));
  else renderer.zoomToFit();
  if (!list.hidden) buildList();
});
element('#clear').addEventListener('click', () => {
  renderer.clearCart();
  update(renderer.getCart());
  element('#cart').focus({ preventScroll: true });
});
element('#list-view').addEventListener('click', () => showList(true));
element('#map-view').addEventListener('click', () => showList(false));
element<HTMLSelectElement>('#venue').addEventListener('change', (event) => {
  void loadVenue((event.currentTarget as HTMLSelectElement).value);
});
element('#export').addEventListener('click', () => {
  const cart = renderer.getCart(),
    payload = {
      venue: currentVenue,
      seatIds: cart.seats.map((s) => s.id),
      total: Math.round(cart.seats.reduce((sum, s) => sum + (s.price ?? 0), 0) * 100),
      currency: 'USD',
      cart,
    };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'seat-selection.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  feedback.textContent = 'Selection exported. No seats have been reserved.';
});
const queryVenue = new URLSearchParams(window.location.search).get('venue') ?? 'theatre';
const initial = Object.hasOwn(descriptions, queryVenue) ? queryVenue : 'theatre';
element<HTMLSelectElement>('#venue').value = initial;
void loadVenue(initial);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    visibility.disconnect();
    renderer.destroy();
  });
