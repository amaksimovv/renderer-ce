import type { ISchemaDTO, IPriceListDTO } from '../src';
import { venues } from './venues';

export const descriptions: Record<string, { name: string; description: string }> = {
  theatre: { name: 'Meridian Hall', description: 'An intimate room. Every seat in view.' },
  arena: { name: 'Roundhouse Arena', description: 'Eight sections. One shared experience.' },
  barclays: {
    name: 'Barclays Center',
    description: 'A full arena, down to every seat.',
  },
};
export async function venueData(
  id: string,
): Promise<{ schema: ISchemaDTO; prices: IPriceListDTO }> {
  if (id === 'barclays') {
    const [schemaResponse, pricesResponse, backgroundResponse] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}maps/barclays.json`),
      fetch(`${import.meta.env.BASE_URL}maps/barclays-prices.json`),
      fetch(`${import.meta.env.BASE_URL}maps/barclays.svg`),
    ]);
    if (!schemaResponse.ok || !pricesResponse.ok || !backgroundResponse.ok)
      throw new Error('Unable to load Barclays Center');
    const schema = (await schemaResponse.json()) as ISchemaDTO;
    const prices = (await pricesResponse.json()) as IPriceListDTO;
    schema.background.svg = await backgroundResponse.text();
    return { schema, prices };
  }
  const venue = venues[id];
  if (!venue) throw new Error('Unknown venue');
  const data = venue.data,
    sections = [...new Set(data.seats.map((s) => s.section ?? 'Seats'))];
  const sectors = sections.map((name, i) => ({ id: i + 1, name, isGa: false }));
  const rowKeys = [...new Set(data.seats.map((s) => `${s.section}:${s.row}`))];
  const rows = rowKeys.map((key, i) => {
    const seat = data.seats.find((s) => `${s.section}:${s.row}` === key)!;
    return {
      id: i + 1,
      rowNumber: i + 1,
      sectorId: sections.indexOf(seat.section ?? 'Seats') + 1,
      name: seat.row ?? '',
      seatName: 'Seat',
    };
  });
  const seats = data.seats.map((s, i) => ({
    id: i + 1,
    x: s.x,
    y: s.y,
    name: s.label,
    rowId: rowKeys.indexOf(`${s.section}:${s.row}`) + 1,
    sectorId: sections.indexOf(s.section ?? 'Seats') + 1,
    isAccessible: s.accessible,
  }));
  const bg = data.background;
  let svg =
    bg?.svg ??
    (bg?.url ? await (await fetch(bg.url)).text() : '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const box = bg?.bounds ?? { x: 0, y: 0, width: 700, height: 700 };
  const wrapped = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrapped.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  doc.documentElement.setAttribute('x', String(box.x));
  doc.documentElement.setAttribute('y', String(box.y));
  doc.documentElement.setAttribute('width', String(box.width));
  doc.documentElement.setAttribute('height', String(box.height));
  wrapped.append(doc.documentElement);
  for (const label of data.labels ?? []) {
    const text = document.createElementNS(wrapped.namespaceURI, 'text');
    text.setAttribute('x', String(label.x));
    text.setAttribute('y', String(label.y));
    text.setAttribute('font-size', String(label.size ?? 12));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', label.color ?? '#333b34');
    text.textContent = label.text;
    wrapped.append(text);
  }
  svg = new XMLSerializer().serializeToString(wrapped);
  const outlines = document.createElementNS(wrapped.namespaceURI, 'svg');
  for (const outline of data.outlines ?? []) {
    const nearby = data.seats.find(
      (s) =>
        s.x >= outline.bounds.x &&
        s.x <= outline.bounds.x + outline.bounds.width &&
        s.y >= outline.bounds.y &&
        s.y <= outline.bounds.y + outline.bounds.height,
    );
    const section = sectors.find((s) => s.name === nearby?.section);
    if (!section) continue;
    const path = document.createElementNS(wrapped.namespaceURI, 'path');
    path.setAttribute('data-gos-id', String(section.id));
    path.setAttribute('data-section-id', String(section.id));
    path.setAttribute('d', outline.path);
    outlines.append(path);
  }
  const categories = data.categories ?? [];
  return {
    schema: {
      seats,
      rows,
      sectors,
      background: {
        svg,
        viewBox: box,
        outlineSvg: new XMLSerializer().serializeToString(outlines),
      },
    },
    prices: {
      prices: categories.map((c, i) => ({ id: i + 1, name: String((c.price ?? 0) / 100) })),
      groupOfSeats: [],
      seats: data.seats.flatMap((s, i) =>
        s.status === 'unavailable'
          ? []
          : [[i + 1, categories.findIndex((c) => c.id === (s.category ?? 'standard')) + 1]],
      ),
    },
  };
}
