import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingClient } from './BookingClient';
import { SeatmapRenderer } from './SeatmapRenderer';
import { ProjectionWindow } from './ProjectionWindow';

const disconnect = vi.fn();
const observe = vi.fn();
let client: BookingClient;
let container: HTMLDivElement;
let renderer: SeatmapRenderer | undefined;

beforeEach(() => {
  client = new BookingClient({
    data: {
      seats: [
        { id: 'left', x: 0, y: 0, label: '1' },
        { id: 'right', x: 24, y: 0, label: '2' },
        { id: 'sold', x: 48, y: 0, label: '3', status: 'unavailable' },
      ],
    },
    maxSelection: 1,
  });
  container = document.createElement('div');
  document.body.append(container);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observe;
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  renderer?.destroy();
  renderer = undefined;
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('renderer lifecycle and keyboard interaction', () => {
  const key = (value: string) => {
    renderer?.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
    );
  };

  it('keeps the projection when selection changes and invalidates it when availability changes', () => {
    const invalidate = vi.spyOn(ProjectionWindow.prototype, 'invalidate');
    renderer = new SeatmapRenderer(container, { client });
    invalidate.mockClear();
    client.select('left');
    client.deselect('left');
    client.select('right');
    client.clear();
    expect(invalidate).not.toHaveBeenCalled();
    client.setAvailability(new Map([['right', 'unavailable']]));
    expect(invalidate).toHaveBeenCalled();
  });

  it('exposes the selected and unavailable states to assistive technology', () => {
    renderer = new SeatmapRenderer(container, { client });
    key('Enter');
    expect(client.snapshot.seatIds).toEqual(['left']);
    expect(container.querySelector('[aria-selected="true"]')?.textContent).toContain('Seat 1');
    expect(container.querySelector('[aria-disabled="true"]')?.textContent).toContain('Unavailable');
  });

  it('moves between seats and announces selection limit failures', () => {
    const onSelectionError = vi.fn();
    renderer = new SeatmapRenderer(container, { client, onSelectionError });
    key('Enter');
    key('ArrowRight');
    key('Enter');
    expect(client.snapshot.seatIds).toEqual(['left']);
    expect(onSelectionError).toHaveBeenCalledWith('limit');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('up to 1');
    key('ArrowRight');
    key('Enter');
    expect(onSelectionError).toHaveBeenCalledWith('unavailable');
  });

  it('reconciles availability and removes stale accessible options', () => {
    renderer = new SeatmapRenderer(container, { client });
    key('Enter');
    client.setData({ seats: [{ id: 'new', x: 10, y: 10, label: '99' }] });
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(client.snapshot.count).toBe(0);
    key('Enter');
    expect(client.snapshot.seatIds).toEqual(['new']);
  });

  it('uses unique accessible option IDs for multiple renderers', () => {
    renderer = new SeatmapRenderer(container, { client });
    const second = new SeatmapRenderer(container, { client });
    expect(second.element.getAttribute('aria-activedescendant')).not.toBe(
      renderer.element.getAttribute('aria-activedescendant'),
    );
    second.destroy();
  });

  it('cleans up listeners, animation frames and owned DOM without removing host content', () => {
    const existing = document.createElement('p');
    container.append(existing);
    renderer = new SeatmapRenderer(container, { client });
    const detached = renderer.element;
    renderer.destroy();
    renderer.destroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(existing);
    detached.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(client.snapshot.count).toBe(0);
    client.select('right');
    expect(detached.querySelector('[aria-selected="true"]')).toBeNull();
  });

  it('fails cleanly when Canvas 2D is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => new SeatmapRenderer(container, { client })).toThrow('Canvas 2D');
    expect(container.children).toHaveLength(0);
  });
});
