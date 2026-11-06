import type { MapOutline, Point, RendererTheme } from './types.js';

export class OutlineLayer {
  private paths: { outline: MapOutline; path: Path2D }[] = [];
  private cache = new Map<string, Path2D>();
  private byId = new Map<string, { outline: MapOutline; path: Path2D }>();

  set(outlines: readonly MapOutline[]): void {
    const cache = new Map<string, Path2D>();
    this.paths = outlines.map((outline) => {
      const key = outline.path + JSON.stringify(outline.transform);
      let path = this.cache.get(key);
      if (!path) {
        path = new Path2D(outline.path);
        if (outline.transform) {
          const transformed = new Path2D();
          transformed.addPath(path, new DOMMatrix([...outline.transform]));
          path = transformed;
        }
      }
      cache.set(key, path);
      return { outline, path };
    });
    this.cache = cache;
    this.byId = new Map(this.paths.map((item) => [item.outline.id, item]));
  }

  paintHover(ctx: CanvasRenderingContext2D, scale: number, theme: RendererTheme, id: string): void {
    const item = this.byId.get(id);
    if (!item || item.outline.stroke === 'none' || item.outline.interactive === false) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.globalAlpha = item.outline.opacity ?? 1;
    ctx.strokeStyle = theme.focus;
    ctx.lineWidth = Math.max(2, item.outline.strokeWidth ?? 1) / scale;
    ctx.stroke(item.path);
    ctx.restore();
  }

  paint(
    ctx: CanvasRenderingContext2D,
    scale: number,
    theme: RendererTheme,
    hovered?: string,
  ): void {
    ctx.save();
    ctx.lineJoin = 'round';
    for (const { outline, path } of this.paths) {
      ctx.globalAlpha = outline.opacity ?? 1;
      if (outline.fill !== 'none') {
        ctx.fillStyle = outline.fill ?? 'rgba(82, 127, 117, 0.08)';
        ctx.fill(path, outline.fillRule ?? 'nonzero');
      }
      ctx.strokeStyle = outline.id === hovered ? theme.focus : (outline.stroke ?? '#99a496');
      const width =
        (outline.id === hovered
          ? Math.max(2, outline.strokeWidth ?? 1)
          : (outline.strokeWidth ?? 1)) / scale;
      if (width > 0 && outline.stroke !== 'none') {
        ctx.lineWidth = width;
        ctx.stroke(path);
      }
    }
    ctx.restore();
  }

  hit(ctx: CanvasRenderingContext2D, point: Point): MapOutline | undefined {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    try {
      for (let i = this.paths.length - 1; i >= 0; i--) {
        const item = this.paths[i];
        if (!item || item.outline.opacity === 0 || item.outline.interactive === false) continue;
        const { outline, path } = item;
        const { bounds } = outline;
        if (
          point.x < bounds.x ||
          point.y < bounds.y ||
          point.x > bounds.x + bounds.width ||
          point.y > bounds.y + bounds.height
        )
          continue;
        if (ctx.isPointInPath(path, point.x, point.y, outline.fillRule ?? 'nonzero'))
          return outline;
      }
      return undefined;
    } finally {
      ctx.restore();
    }
  }

  destroy(): void {
    this.paths = [];
    this.cache.clear();
    this.byId.clear();
  }
}
