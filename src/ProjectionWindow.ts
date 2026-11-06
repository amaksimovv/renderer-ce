import { Viewport } from './geometry.js';
import { paint } from './paint.js';
import type { PaintOptions } from './paint.js';
import type { ViewTransform } from './ViewportAnimation.js';

interface Raster {
  canvas: HTMLCanvasElement;
  view: Viewport;
  width: number;
  height: number;
}

function covers(raster: Raster, view: ViewTransform, width: number, height: number): boolean {
  const factor = view.scale / raster.view.scale;
  const x = view.x - raster.view.x * factor;
  const y = view.y - raster.view.y * factor;
  return (
    x <= 1e-7 &&
    y <= 1e-7 &&
    x + raster.width * factor >= width - 1e-7 &&
    y + raster.height * factor >= height - 1e-7
  );
}

export class ProjectionWindow {
  private rasters: Raster[] = [];
  private current?: Raster;
  private ratio = 0;

  invalidate(): void {
    for (const { canvas } of this.rasters) canvas.width = canvas.height = 0;
    this.rasters = [];
    this.current = undefined;
  }

  draw(options: PaintOptions, animating: boolean, target?: ViewTransform): void {
    const { viewport: view, context, width, height, pixelRatio } = options;
    if (this.ratio !== pixelRatio) this.invalidate();
    this.ratio = pixelRatio;
    const end = target ?? view;
    const reusable = (raster: Raster) =>
      covers(raster, view, width, height) &&
      (!animating || covers(raster, end, width, height)) &&
      (animating || Math.abs(raster.view.scale / view.scale - 1) < 1e-9);
    let raster =
      this.current && reusable(this.current)
        ? this.current
        : this.rasters.filter(reusable).sort((a, b) => b.view.scale - a.view.scale)[0];
    if (!raster) {
      raster = this.rasterize(options, animating ? target : undefined);
      if (!raster) return;
    }
    this.current = raster;
    this.rasters = [...this.rasters.filter((item) => item !== raster), raster];
    if (this.rasters.length > 3) {
      const overview = this.rasters.reduce((a, b) => (a.view.scale < b.view.scale ? a : b));
      const oldest = this.rasters.findIndex((item) => item !== overview);
      const [removed] = this.rasters.splice(oldest, 1);
      removed!.canvas.width = removed!.canvas.height = 0;
    }
    const scale = view.scale / raster.view.scale;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.drawImage(
      raster.canvas,
      view.x - raster.view.x * scale,
      view.y - raster.view.y * scale,
      raster.width * scale,
      raster.height * scale,
    );
    context.translate(view.x, view.y);
    context.scale(view.scale, view.scale);
  }

  private rasterize(options: PaintOptions, target?: ViewTransform): Raster | undefined {
    const { viewport: view, width, height, pixelRatio } = options;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    const paddingX = Math.min(320, Math.ceil(width * 0.35));
    const paddingY = Math.min(320, Math.ceil(height * 0.35));
    const raster = {
      canvas,
      view: Object.assign(new Viewport(), {
        x: view.x + paddingX,
        y: view.y + paddingY,
        scale: view.scale,
      }),
      width: width + paddingX * 2,
      height: height + paddingY * 2,
    };
    if (target) {
      const left = Math.min(-view.x / view.scale, -target.x / target.scale);
      const top = Math.min(-view.y / view.scale, -target.y / target.scale);
      const right = Math.max((width - view.x) / view.scale, (width - target.x) / target.scale);
      const bottom = Math.max((height - view.y) / view.scale, (height - target.y) / target.scale);
      const scale = Math.min(
        view.scale,
        target.scale,
        width / (right - left),
        height / (bottom - top),
      );
      raster.width = Math.ceil((right - left) * scale) + paddingX * 2;
      raster.height = Math.ceil((bottom - top) * scale) + paddingY * 2;
      Object.assign(raster.view, {
        x: -left * scale + paddingX,
        y: -top * scale + paddingY,
        scale,
      });
    }
    canvas.width = Math.ceil(raster.width * pixelRatio);
    canvas.height = Math.ceil(raster.height * pixelRatio);
    paint({
      ...options,
      context,
      viewport: raster.view,
      width: raster.width,
      height: raster.height,
    });
    return raster;
  }

  destroy(): void {
    this.invalidate();
  }
}
