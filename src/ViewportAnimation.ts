import type { Viewport } from './geometry.js';

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export class ViewportAnimation {
  private pending?: { frame: number; resolve: () => void; target: ViewTransform };

  constructor(
    private view: Viewport,
    private redraw: () => void,
    private onStart?: (scale: number, previous: number) => void,
    private onEnd?: (scale: number, previous: number) => void,
  ) {}

  get active(): boolean {
    return this.pending !== undefined;
  }

  get target(): ViewTransform {
    return this.pending?.target ?? this.view;
  }

  to(target: ViewTransform, duration: number): Promise<void> {
    this.cancel();
    const previous = this.view.scale;
    this.onStart?.(target.scale, previous);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      Object.assign(this.view, target);
      this.redraw();
      this.onEnd?.(target.scale, previous);
      return Promise.resolve();
    }
    const start = { x: this.view.x, y: this.view.y, scale: this.view.scale };
    const time = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        const progress = Math.min(1, Math.max(0, (now - time) / duration));
        const eased = 1 - (1 - progress) ** 3;
        this.view.scale = start.scale + (target.scale - start.scale) * eased;
        this.view.x = start.x + (target.x - start.x) * eased;
        this.view.y = start.y + (target.y - start.y) * eased;
        if (progress === 1) {
          this.pending = undefined;
          this.onEnd?.(target.scale, previous);
          resolve();
        } else this.pending = { frame: requestAnimationFrame(tick), resolve, target };
        this.redraw();
      };
      this.pending = { frame: requestAnimationFrame(tick), resolve, target };
    });
  }

  cancel(): void {
    if (!this.pending) return;
    cancelAnimationFrame(this.pending.frame);
    this.pending.resolve();
    this.pending = undefined;
    this.redraw();
  }
}
