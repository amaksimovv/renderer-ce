import type { Category, MapLabel, Seat, SeatmapData } from '../src/types';
import theatreSvg from './assets/meridian.svg?raw';
import arenaSvgUrl from './assets/roundhouse.svg?url';
import { arenaOutlines, theatreOutlines, type DemoOutline } from './outlines';

export interface DemoVenue {
  readonly name: string;
  readonly description: string;
  readonly data: SeatmapData & { outlines: DemoOutline[] };
}

const categories: readonly Category[] = [
  { id: 'premium', label: 'Premium', price: 8500, color: '#96743a' },
  { id: 'standard', label: 'Standard', price: 5500, color: '#4c7a6d' },
  { id: 'balcony', label: 'Balcony', price: 3500, color: '#757b9d' },
];

function theatre(): DemoVenue {
  const seats: Seat[] = [];
  const labels: MapLabel[] = [];
  for (let row = 0; row < 12; row++) {
    const rowName = String.fromCharCode(65 + row);
    const y = 95 + row * 27 + (row >= 8 ? 36 : 0);
    labels.push({ x: 28, y, text: rowName, size: 10 }, { x: 562, y, text: rowName, size: 10 });
    for (let column = 0; column < 20; column++) {
      seats.push({
        id: `${rowName}${column + 1}`,
        x: 60 + column * 23 + (column >= 5 ? 24 : 0) + (column >= 15 ? 24 : 0),
        y: y + 8 * ((column - 9.5) / 9.5) ** 2,
        label: String(column + 1),
        row: rowName,
        section: row >= 8 ? 'Balcony' : 'Stalls',
        category: row < 4 ? 'premium' : row < 8 ? 'standard' : 'balcony',
        status: (row * 17 + column * 7) % 11 < 2 && column !== 0 ? 'unavailable' : 'available',
        accessible: row === 7 && (column === 0 || column === 19),
      });
    }
  }
  labels.push({ x: 295, y: 305, text: 'BALCONY', size: 9, color: '#70746c' });
  return {
    name: 'Meridian Hall',
    description: 'An intimate room. Every seat in view.',
    data: {
      seats,
      categories,
      labels,
      background: { svg: theatreSvg, bounds: { x: 0, y: 0, width: 600, height: 470 } },
      outlines: theatreOutlines(),
    },
  };
}

function arena(): DemoVenue {
  const seats: Seat[] = [];
  const labels: MapLabel[] = [];
  for (let section = 0; section < 8; section++) {
    const angle = (section * Math.PI) / 4;
    labels.push({
      x: 525 + Math.cos(angle) * 460,
      y: 525 + Math.sin(angle) * 460,
      text: `S${section + 1}`,
      size: 12,
    });
    for (let row = 0; row < 8; row++) {
      const columns = [8, 9, 10, 11, 13, 14, 15, 16][row]!;
      for (let column = 0; column < columns; column++) {
        const theta = angle + ((column + 0.5) / columns - 0.5) * 0.66;
        const radius = 210 + row * 30;
        seats.push({
          id: `S${section + 1}-${row + 1}-${column + 1}`,
          x: 525 + Math.cos(theta) * radius,
          y: 525 + Math.sin(theta) * radius,
          label: String(column + 1),
          row: String(row + 1),
          section: `Section ${section + 1}`,
          category: row < 2 ? 'premium' : row < 5 ? 'standard' : 'balcony',
          status: (section * 31 + row * 7 + column * 3) % 13 < 2 ? 'unavailable' : 'available',
          accessible: row === 7 && column === 0,
        });
      }
    }
  }
  return {
    name: 'The Roundhouse',
    description: 'One stage. Eight sections. A different perspective.',
    data: {
      seats,
      categories,
      labels,
      background: { url: arenaSvgUrl, bounds: { x: 0, y: 0, width: 1050, height: 1050 } },
      outlines: arenaOutlines(),
    },
  };
}

export const venues: Readonly<Record<string, DemoVenue>> = { theatre: theatre(), arena: arena() };
