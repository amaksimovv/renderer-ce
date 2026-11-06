import { Viewport } from './geometry.js';

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export class ViewportAnimation {
  private pending?: { frame: number; resolve: () => void; target: ViewTransform };

  private wheel?: { frame: number; target: ViewTransform };

  constructor(
    private view: Viewport,
    private redraw: () => void,
    private onStart?: (scale: number, previous: number) => void,
    private onEnd?: (scale: number, previous: number) => void,
  ) {}

  get active(): boolean {
    return !!(this.pending || this.wheel);
  }

  get target(): ViewTransform {
    return this.wheel?.target ?? this.pending?.target ?? this.view;
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

  scroll(factor: number, anchor: { x: number; y: number }): void {
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
    if (this.pending) this.cancel();
    const visible = this.view.scale;
    const queued = this.wheel?.target.scale ?? visible;
    const reversing = (queued - visible) * (factor - 1) < 0;
    const target = Object.assign(new Viewport(), this.view);
    target.zoom((reversing ? 1 : queued / visible) * factor, anchor);
    if (this.wheel) {
      this.wheel.target = target;
      return;
    }
    if (target.scale === visible) return;
    this.onStart?.(target.scale, visible);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(this.view, { x: target.x, y: target.y, scale: target.scale });
      this.redraw();
      this.onEnd?.(target.scale, visible);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const motion = this.wheel;
      if (!motion) return;
      const end = motion.target;
      const remaining = Math.log(end.scale / this.view.scale);
      const elapsed = Math.max(0, Math.min(32, now - last));
      last = now;
      const step = remaining * -Math.expm1(-elapsed / 48);
      const done = Math.abs(remaining) < 0.0003;
      const fraction = done ? 1 : Math.expm1(step) / Math.expm1(remaining);
      this.view.x += (end.x - this.view.x) * fraction;
      this.view.y += (end.y - this.view.y) * fraction;
      this.view.scale = done ? end.scale : this.view.scale * Math.exp(step);
      if (done) {
        this.wheel = undefined;
        this.onEnd?.(end.scale, visible);
      } else motion.frame = requestAnimationFrame(tick);
      this.redraw();
    };
    this.wheel = { frame: requestAnimationFrame(tick), target };
  }

  cancel(): void {
    if (this.wheel) {
      cancelAnimationFrame(this.wheel.frame);
      this.wheel = undefined;
      this.redraw();
    }
    if (!this.pending) return;
    cancelAnimationFrame(this.pending.frame);
    this.pending.resolve();
    this.pending = undefined;
    this.redraw();
  }
}
