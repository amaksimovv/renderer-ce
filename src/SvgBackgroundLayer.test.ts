import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeSvg, SvgBackgroundLayer } from './SvgBackgroundLayer';
import type { SvgBackground } from './types';

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 100 80"><rect x="10" y="20" width="100" height="80" fill="red"/></svg>';
const source: SvgBackground = { svg, bounds: { x: -100, y: 50, width: 300, height: 240 } };
const changed = vi.fn();
const failed = vi.fn();
const revoke = vi.fn();
const create = vi.fn().mockReturnValue('blob:test');
const images: FakeImage[] = [];
let layer: SvgBackgroundLayer;

class FakeImage {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    images.push(this);
  }
}

beforeEach(() => {
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  vi.stubGlobal('Image', FakeImage);
  layer = new SvgBackgroundLayer(changed, failed);
});

afterEach(() => {
  layer.destroy();
  images.length = 0;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('SVG backgrounds', () => {
  it('preserves the SVG viewBox and provides explicit decode dimensions', () => {
    const result = normalizeSvg(svg, source.bounds);
    expect(result).toContain('viewBox="10 20 100 80"');
    expect(result).toContain('width="300"');
    expect(result).toContain('height="240"');
    expect(result).toContain('preserveAspectRatio="none"');
    expect(document.querySelector('svg')).toBeNull();
  });

  it.each(['<html/>', '<svg><broken></svg>', '<svg xmlns="urn:other"/>', '<!DOCTYPE svg><svg/>'])(
    'rejects a non-SVG or malformed document',
    (value) => {
      expect(() => normalizeSvg(value, source.bounds)).toThrow(TypeError);
    },
  );

  it('adds a viewBox for dimensionless SVG', () => {
    expect(normalizeSvg('<svg/>', source.bounds)).toContain('viewBox="0 0 300 240"');
  });

  it('decodes a background, reports readiness and releases its object URL', async () => {
    layer.set(source);
    expect(layer.status).toBe('loading');
    images[0]?.onload?.();
    await vi.waitFor(() => {
      expect(layer.status).toBe('ready');
    });
    expect(layer.image).toBe(images[0]);
    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(failed).not.toHaveBeenCalled();
  });

  it('does not reload the image for an availability refresh or changed placement', async () => {
    layer.set(source);
    images[0]?.onload?.();
    await vi.waitFor(() => {
      expect(layer.status).toBe('ready');
    });
    layer.set({ ...source, opacity: 0.5, bounds: { ...source.bounds, x: 100 } });
    expect(images).toHaveLength(1);
  });

  it('aborts the previous decode when switching backgrounds', async () => {
    layer.set(source);
    const old = images[0];
    layer.set({ ...source, svg: '<svg><circle r="5"/></svg>' });
    expect(old?.src).toBe('');
    expect(old?.onload).toBeNull();
    images[1]?.onload?.();
    await vi.waitFor(() => {
      expect(layer.image).toBe(images[1]);
    });
    expect(failed).not.toHaveBeenCalled();
  });

  it('ignores stale URL responses after a newer background is ready', async () => {
    let complete: (response: Response) => void = () => {
      throw new Error('Fetch not called');
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    layer.set({ url: 'https://example.test/plan.svg', bounds: source.bounds });
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    layer.set(source);
    images[0]?.onload?.();
    await vi.waitFor(() => {
      expect(layer.status).toBe('ready');
    });
    complete(new Response('<svg/>'));
    await Promise.resolve();
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(images).toHaveLength(1);
    expect(layer.status).toBe('ready');
  });

  it('reports HTTP and decode errors without unhandled rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 })),
    );
    layer.set({ url: 'https://example.test/missing.svg', bounds: source.bounds });
    await vi.waitFor(() => {
      expect(layer.status).toBe('error');
    });
    expect(failed.mock.calls[0]?.[0]).toMatchObject({
      message: 'Unable to load SVG background (HTTP 404)',
    });
    layer.set(source);
    images[0]?.onerror?.();
    await vi.waitFor(() => {
      expect(layer.status).toBe('error');
    });
    expect(layer.image).toBeUndefined();
  });

  it('cancels loading when removed or destroyed', () => {
    layer.set(source);
    layer.set(undefined);
    expect(layer.status).toBe('empty');
    expect(images[0]?.onload).toBeNull();
    layer.set(source);
    layer.destroy();
    expect(images[1]?.onload).toBeNull();
    expect(layer.image).toBeUndefined();
  });
});
