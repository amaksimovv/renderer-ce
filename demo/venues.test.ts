import { expect, it, vi } from 'vitest';
import { venueData } from './data';
import arenaBackground from './assets/roundhouse.svg?raw';

it.each(['arena', 'theatre'])(
  'keeps %s seats inside the map and separates seats along each row',
  async (id) => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(arenaBackground));
    try {
      const { schema } = await venueData(id);
      const { width, height } = schema.background.viewBox;
      const parsed = new DOMParser().parseFromString(
        schema.background.outlineSvg!,
        'image/svg+xml',
      );
      for (const section of schema.sectors) {
        expect(parsed.querySelectorAll(`[data-section-id="${section.id}"]`)).toHaveLength(
          id === 'arena' ? 1 : 3,
        );
      }
      for (const row of schema.rows) {
        const seats = schema.seats.filter((s) => s.rowId === row.id);
        expect(row.rowNumber).toBe(id === 'arena' ? Number(row.name) : row.name.charCodeAt(0) - 64);
        for (const [i, seat] of seats.entries()) {
          expect(seat.x >= 8 && seat.x <= width - 8 && seat.y >= 8 && seat.y <= height - 8).toBe(
            true,
          );
          const prior = seats[i - 1];
          if (prior) expect(Math.hypot(seat.x - prior.x, seat.y - prior.y)).toBeGreaterThan(16);
        }
      }
    } finally {
      fetch.mockRestore();
    }
  },
);
