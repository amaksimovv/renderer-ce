import type { Category, MapLabel, Seat, SeatmapData } from '../src/types';
import theatreSvg from './assets/meridian.svg?raw';
import arenaSvgUrl from './assets/roundhouse.svg?url';
import { arenaOutlines, theatreOutlines } from './outlines';

export interface DemoVenue {
  readonly name: string;
  readonly description: string;
  readonly data: SeatmapData;
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
        y: y + (column < 5 || column >= 15 ? 6 : 0),
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
      background: { svg: theatreSvg, bounds: { x: 25, y: 10, width: 540, height: 432 } },
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
      x: 350 + Math.cos(angle) * 305,
      y: 350 + Math.sin(angle) * 305,
      text: `S${section + 1}`,
      size: 12,
    });
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 12; column++) {
        const theta = angle + (column - 5.5) * 0.053;
        const radius = 140 + row * 20;
        seats.push({
          id: `S${section + 1}-${row + 1}-${column + 1}`,
          x: 350 + Math.cos(theta) * radius,
          y: 350 + Math.sin(theta) * radius,
          label: String(column + 1),
          row: String(row + 1),
          section: `Section ${section + 1}`,
          category: row < 2 ? 'premium' : row < 5 ? 'standard' : 'balcony',
          status: (section * 31 + row * 13 + column * 3) % 13 < 2 ? 'unavailable' : 'available',
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
      background: { url: arenaSvgUrl, bounds: { x: 15, y: 15, width: 670, height: 670 } },
      outlines: arenaOutlines(),
    },
  };
}

export const venues: Readonly<Record<string, DemoVenue>> = { theatre: theatre(), arena: arena() };
