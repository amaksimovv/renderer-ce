import type { Point } from './types.js';

export class HoverThrottle {
  private last = -Infinity;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Point;

  constructor(
    private callback: (point: Point | undefined) => void,
    private interval = 50,
  ) {}

  update(point: Point | undefined): void {
    if (!point) {
      this.cancel();
      this.callback(undefined);
      return;
    }
    this.pending = point;
    const remaining = this.interval - (performance.now() - this.last);
    if (remaining <= 0) {
      clearTimeout(this.timer);
      this.flush();
    } else if (this.timer === undefined) this.timer = setTimeout(() => this.flush(), remaining);
  }

  private flush(): void {
    const point = this.pending;
    this.timer = undefined;
    this.pending = undefined;
    if (!point) return;
    this.last = performance.now();
    this.callback(point);
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
    this.last = -Infinity;
  }
}
