import type * as PaintModule from './paint';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectionWindow } from './ProjectionWindow';
import { Viewport, SeatIndex } from './geometry';
import { BookingClient } from './BookingClient';
import { OutlineLayer } from './OutlineLayer';
import { defaultTheme, paint } from './paint';

vi.mock('./paint', async (original) => ({
  ...(await original<typeof PaintModule>()),
  paint: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

it('reuses the padded projection during pan, refills at its boundary and invalidates on data changes', () => {
  const context = {
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  const projection = new ProjectionWindow();
  const viewport = new Viewport();
  const options = {
    context,
    viewport,
    width: 800,
    height: 600,
    pixelRatio: 2,
    radius: 8,
    client: new BookingClient({ data: { seats: [] } }),
    index: new SeatIndex([]),
    outlines: new OutlineLayer(),
    theme: defaultTheme,
  };
  vi.mocked(paint).mockClear();
  projection.draw(options, false);
  for (let i = 0; i < 100; i++) {
    viewport.x++;
    projection.draw(options, false);
  }
  expect(paint).toHaveBeenCalledTimes(1);
  viewport.x += 300;
  projection.draw(options, false);
  expect(paint).toHaveBeenCalledTimes(2);
  projection.invalidate();
  projection.draw(options, false);
  expect(paint).toHaveBeenCalledTimes(3);
  viewport.scale *= 1.1;
  projection.draw(options, true);
  expect(paint).toHaveBeenCalledTimes(3);
  projection.draw(options, false);
  expect(paint).toHaveBeenCalledTimes(4);
  projection.destroy();
});

it('rasterizes a cold zoom-out once at the destination resolution', () => {
  const context = {
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  const projection = new ProjectionWindow();
  const viewport = Object.assign(new Viewport(), { x: -2500, y: -1500, scale: 2 });
  const options = {
    context,
    viewport,
    width: 800,
    height: 600,
    pixelRatio: 2,
    radius: 8,
    client: new BookingClient({ data: { seats: [] } }),
    index: new SeatIndex([]),
    outlines: new OutlineLayer(),
    theme: defaultTheme,
  };
  const start = { x: viewport.x, y: viewport.y, scale: viewport.scale };
  const target = { x: 100, y: 50, scale: 0.14 };
  vi.mocked(paint).mockClear();
  projection.draw(options, true, target);
  for (let frame = 1; frame <= 24; frame++) {
    const t = frame / 24;
    Object.assign(viewport, {
      x: start.x + (target.x - start.x) * t,
      y: start.y + (target.y - start.y) * t,
      scale: start.scale + (target.scale - start.scale) * t,
    });
    projection.draw(options, true, target);
  }
  expect(paint).toHaveBeenCalledTimes(1);
  const raster = vi.mocked(paint).mock.calls[0]![0];
  expect(raster.width).toBeLessThanOrEqual(1361);
  expect(raster.height).toBeLessThanOrEqual(1021);
  expect(raster.viewport.scale).toBeCloseTo(target.scale);
  projection.draw(options, false);
  expect(paint).toHaveBeenCalledTimes(1);
  projection.invalidate();
  projection.draw(options, false);
  expect(paint).toHaveBeenCalledTimes(2);
  projection.destroy();
});

function cachedOverview() {
  const context = {
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  const projection = new ProjectionWindow();
  const viewport = Object.assign(new Viewport(), { scale: 0.035 });
  const options = {
    context,
    viewport,
    width: 800,
    height: 600,
    pixelRatio: 2,
    radius: 8,
    client: new BookingClient({ data: { seats: [] } }),
    index: new SeatIndex([]),
    outlines: new OutlineLayer(),
    theme: defaultTheme,
  };
  vi.mocked(paint).mockClear();
  projection.draw(options, false);
  const zoom = (scale: number) => {
    const start = { x: viewport.x, y: viewport.y, scale: viewport.scale };
    const target = { x: 400 - (400 * scale) / 0.035, y: 300 - (300 * scale) / 0.035, scale };
    for (let frame = 1; frame <= 24; frame++) {
      const t = frame / 24;
      Object.assign(viewport, {
        x: start.x + (target.x - start.x) * t,
        y: start.y + (target.y - start.y) * t,
        scale: start.scale + (target.scale - start.scale) * t,
      });
      projection.draw(options, frame < 24, target);
    }
  };
  return { projection, viewport, options, zoom };
}

it('keeps the overview raster through repeated 132%, 100%, 7% zoom cycles', () => {
  const { projection, zoom } = cachedOverview();
  for (let round = 0; round < 2; round++) {
    zoom(0.66);
    zoom(0.5);
    const draws = vi.mocked(paint).mock.calls.length;
    zoom(0.035);
    expect(paint).toHaveBeenCalledTimes(draws);
  }
  expect(paint).toHaveBeenCalledTimes(3);
  projection.destroy();
});

it('invalidates retained overview rasters when seats change or pixel density changes', () => {
  const { projection, options, zoom } = cachedOverview();
  zoom(0.66);
  projection.invalidate();
  const draws = vi.mocked(paint).mock.calls.length;
  zoom(0.035);
  expect(paint).toHaveBeenCalledTimes(draws + 1);
  options.pixelRatio = 3;
  projection.draw(options, false);
  expect(paint).toHaveBeenCalledTimes(draws + 2);
  projection.destroy();
});

it('bounds raster memory and releases every canvas when destroyed', () => {
  const created = vi.spyOn(document, 'createElement');
  const { projection, zoom } = cachedOverview();
  for (const scale of [0.5, 0.66, 1, 1.5, 2]) zoom(scale);
  const canvases = created.mock.results
    .map((result: { value: unknown }) => result.value)
    .filter((element): element is HTMLCanvasElement => element instanceof HTMLCanvasElement);
  expect(canvases.filter((canvas) => canvas.width > 0)).toHaveLength(3);
  const draws = vi.mocked(paint).mock.calls.length;
  zoom(0.035);
  expect(paint).toHaveBeenCalledTimes(draws);
  projection.destroy();
  expect(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
});

it('repaints at full resolution after a transition requiring a wider raster', () => {
  const { projection, viewport, options } = cachedOverview();
  const target = { x: -20000, y: -10000, scale: 1 };
  projection.draw(options, true, target);
  const transition = vi.mocked(paint).mock.calls.at(-1)![0];
  expect(transition.viewport.scale).toBeLessThan(target.scale);
  Object.assign(viewport, target);
  const draws = vi.mocked(paint).mock.calls.length;
  projection.draw(options, false);
  expect(paint).toHaveBeenCalledTimes(draws + 1);
  expect(vi.mocked(paint).mock.calls.at(-1)![0].viewport.scale).toBe(target.scale);
  projection.destroy();
});
