import { describe, expect, it } from 'vitest';
import { validateSettings } from './public-settings';
import { SeatmapBookingRenderer } from './SeatmapBookingRenderer';
import type { IBookingRendererSettings } from './public-types';

describe('public CE settings', () => {
  it('rejects unavailable commercial options instead of silently accepting them', () => {
    for (const setting of [
      { enable3DView: true },
      { minimap: { enabled: true } },
      { groupSize: 2 },
      { hotkeys: true },
      { forceSvg: false },
      { theme: { images: {} } },
      { loader: { customRenderer: () => '' } },
    ]) {
      expect(() =>
        validateSettings({ publicKey: 'test', ...setting } as IBookingRendererSettings),
      ).toThrow();
    }
  });
  it('rejects unsupported image styles and stroke alignment', () => {
    for (const style of [
      { size: 16, color: 'red', imageId: 'custom' },
      { size: 16, color: 'red', stroke: { width: 2, color: 'blue', align: 'inside' } },
    ]) {
      expect(() => validateSettings({ theme: { seatStyles: { default: style } } })).toThrow();
    }
  });
  it('rejects unsupported options before allocating a canvas', () => {
    const host = document.createElement('div');
    expect(
      () =>
        new SeatmapBookingRenderer(host, {
          publicKey: 'test',
          minimap: {},
        } as IBookingRendererSettings),
    ).toThrow('settings.minimap');
    expect(host.childElementCount).toBe(0);
  });
});
