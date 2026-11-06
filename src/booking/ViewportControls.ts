import { SectionControls } from './SectionControls.js';
import { UnsupportedFeatureError } from './settings.js';
import type { IPoint } from './settings.js';
import type { IRendererSequenceStep } from './IRenderer.js';
import type { ISection, IMarker, IResolvedMarker, MinimapPosition } from './models.js';
import type { Viewport } from '../geometry.js';

export class ViewportControls extends SectionControls {
  private minimap?: HTMLCanvasElement;
  private customMarkers = new Map<string, HTMLImageElement>();
  private markerUrls = new Set<string>();
  getWidth(): number {
    return this.canvas.getSize().width;
  }
  getHeight(): number {
    return this.canvas.getSize().height;
  }
  setHeight(height: number): void {
    if (!Number.isFinite(height) || height <= 0) throw new RangeError('height must be positive');
    this.host.style.height = `${height}px`;
  }
  getMode(): string | undefined {
    return this.mode;
  }
  setMode(mode: string): boolean {
    this.mode = mode;
    return true;
  }
  getZoom(): number {
    return this.canvas.getViewport().scale * (window.devicePixelRatio || 1);
  }
  getMinZoom(): number {
    return this.zoomPresets()[0]!;
  }
  getMaxZoom(): number {
    return this.zoomPresets().at(-1)!;
  }
  private zoomPresets(): number[] {
    const ratio = window.devicePixelRatio || 1;
    const fit = this.canvas.getViewport().fitScale * ratio;
    return [
      fit,
      ...(this.settings.zoomSettings?.presets ?? [0.5, 1, 2])
        .map((scale) => scale * ratio)
        .filter((scale) => Math.max(scale / fit, fit / scale) > 1.2),
    ].sort((a, b) => a - b);
  }
  zoomIn(): void {
    const ratio = window.devicePixelRatio || 1;
    const target = this.canvas.getTargetZoom() * ratio;
    this.zoomTo(
      (this.zoomPresets().find((scale) => scale > target + 1e-9) ?? this.getMaxZoom()) / ratio,
    );
  }
  zoomOut(): void {
    const ratio = window.devicePixelRatio || 1;
    const target = this.canvas.getTargetZoom() * ratio;
    this.zoomTo(
      ([...this.zoomPresets()].reverse().find((scale) => scale < target - 1e-9) ??
        this.getMinZoom()) / ratio,
    );
  }
  zoomToFit(): void {
    this.canvas.fit(this.settings.zoomAnimationDuration ?? 400);
  }
  zoomTo(scale: number, options?: { destination?: IPoint; durationMs?: number }): void {
    void this.animateViewport(
      scale,
      options?.destination,
      options?.durationMs ?? this.settings.zoomAnimationDuration ?? 400,
    );
  }
  zoomToDestination(scale: number, destination: IPoint, duration?: number): void {
    const cssScale = scale / (window.devicePixelRatio || 1);
    this.zoomTo(cssScale, {
      destination: {
        x:
          destination.x - (this.schema?.background.viewBox.x ?? 0) + this.getWidth() / 2 / cssScale,
        y:
          destination.y -
          (this.schema?.background.viewBox.y ?? 0) +
          this.getHeight() / 2 / cssScale,
      },
      durationMs: duration,
    });
  }
  zoomToSection(
    section: string | number,
    options?: { focus?: boolean; mode?: 'fit' | 'scale'; scale?: number },
  ): void {
    const id =
      typeof section === 'number'
        ? section
        : this.getSections().find((s) => s.name === section)?.id;
    if (id === undefined || !this.sections.has(id)) return;
    const bounds = this.sectionBounds(id);
    if ((options?.mode ?? this.settings.zoomToSectionMode) === 'scale')
      this.zoomTo(options?.scale ?? this.settings.zoomToSectionDefaultScale ?? 1, {
        destination: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      });
    else {
      const padding = this.settings.zoomToSectionFitPadding ?? 0.1;
      let fit = Math.min(
        (this.getWidth() * (1 - padding)) / bounds.width,
        (this.getHeight() * (1 - padding)) / bounds.height,
      );
      const thresholds = this.settings.zoomToSectionAdaptiveThreshold ?? {
        small: 200,
        large: 1000,
      };
      const size = Math.max(bounds.width, bounds.height);
      if (size < thresholds.small) fit = Math.min(fit, 2);
      else if (size > thresholds.large) fit = Math.max(fit, 0.5);
      const scale = Math.max(
        0.66,
        Math.min(fit, this.settings.zoomSettings?.maxZoomToFitScale ?? 1),
      );
      this.zoomTo(scale, {
        destination: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      });
    }
    if (options?.focus) this.highlightSector(id);
  }
  viewSection(section: ISection): void {
    if (section.id !== undefined) this.zoomToSection(section.id);
  }
  async animateSequence(steps: IRendererSequenceStep[]): Promise<void> {
    for (const step of steps) {
      if (this.destroyed) return;
      if (step.rotateTo || step.tiltTo || step.perspectiveTo)
        throw new UnsupportedFeatureError('3D animation');
      await this.animateViewport(
        step.zoomTo ?? this.canvas.getViewport().scale,
        step.destination,
        step.durationMs ?? this.settings.transformAnimationDuration ?? 300,
      );
    }
  }
  private animateViewport(scale: number, destination?: IPoint, duration = 0): Promise<void> {
    return this.canvas.zoomTo(scale, destination, duration);
  }
  private cancelAnimation(): void {
    this.canvas.stopAnimation();
  }
  update3DView(options: { rotationZ?: number; perspectiveZ?: number; tiltX?: number }): void {
    if (Object.values(options).some(Boolean)) throw new UnsupportedFeatureError('3D view');
  }
  get3DViewParams(): { rotationZ: number; perspectiveZ: number; tiltX: number } {
    return { rotationZ: 0, perspectiveZ: 0, tiltX: 0 };
  }
  async animateTo3DParams(
    target: { rotationZ?: number; perspectiveZ?: number; tiltX?: number },
    durationMs = 800,
  ): Promise<void> {
    this.update3DView(target);
    if (durationMs < 0) throw new RangeError('durationMs must be non-negative');
  }
  animateRotation(angle: number): number | null {
    if (angle) throw new UnsupportedFeatureError('3D rotation');
    return null;
  }
  stopRotationAnimation(): void {
    this.cancelAnimation();
  }
  isRotationAnimationRunning(): boolean {
    return false;
  }
  getRotationAnimationId(): number | null {
    return null;
  }
  addMarker(marker: IMarker): void {
    this.markers.set(marker.id, structuredClone(marker));
    const appearance = marker.appearance ?? this.settings.markers?.defaultAppearance;
    if (appearance?.type === 'custom') {
      const url = URL.createObjectURL(new Blob([appearance.svg], { type: 'image/svg+xml' })),
        image = new Image();
      this.markerUrls.add(url);
      const cleanup = () => {
        URL.revokeObjectURL(url);
        this.markerUrls.delete(url);
      };
      image.onload = () => {
        cleanup();
        if (!this.destroyed && this.markers.has(marker.id)) {
          this.customMarkers.set(marker.id, image);
          this.canvas.redraw();
        }
      };
      image.onerror = cleanup;
      image.src = url;
    }
    this.canvas.redraw();
  }
  removeMarker(markerId: string): void {
    this.markers.delete(markerId);
    this.customMarkers.delete(markerId);
    this.canvas.redraw();
  }
  clearMarkers(): void {
    this.markers.clear();
    this.customMarkers.clear();
    this.canvas.redraw();
  }
  getMarkers(): IMarker[] {
    return structuredClone([...this.markers.values()]);
  }
  getResolvedMarkers(): IResolvedMarker[] {
    return this.getMarkers().flatMap((marker) => {
      const target = marker.target;
      if (target.type === 'point') return [{ marker, x: target.x, y: target.y }];
      if (target.type === 'seat') {
        const seat = this.seats.get(target.seatId);
        return seat ? [{ marker, x: seat.x, y: seat.y }] : [];
      }
      if (!this.sections.has(target.sectionId)) return [];
      const b = this.sectionBounds(target.sectionId);
      return [{ marker, x: b.x + b.width / 2, y: b.y + b.height / 2 }];
    });
  }
  protected drawOverlays(ctx: CanvasRenderingContext2D, view: Viewport): void {
    ctx.save();
    for (const { marker, x, y } of this.getResolvedMarkers()) {
      if (!(marker.showOnCanvas ?? this.settings.markers?.defaultShowOnCanvas ?? true)) continue;
      const style = marker.appearance ??
        this.settings.markers?.defaultAppearance ?? { type: 'pin', color: '#db3b49' };
      if (style.type === 'custom') {
        const image = this.customMarkers.get(marker.id);
        if (image)
          ctx.drawImage(
            image,
            x - (style.width ?? 24) / view.scale / 2,
            y - (style.height ?? 32) / view.scale,
            (style.width ?? 24) / view.scale,
            (style.height ?? 32) / view.scale,
          );
        continue;
      }
      const r = (style.type === 'circle' ? (style.radius ?? 10) : 8) / view.scale;
      ctx.fillStyle = style.color ?? '#db3b49';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (style.type === 'circle' && style.label) {
        ctx.fillStyle = 'white';
        ctx.font = `${10 / view.scale}px sans-serif`;
        ctx.fillText(style.label, x, y);
      }
    }
    ctx.restore();
    this.drawMinimap();
  }
  showMinimap(): void {
    if (!this.minimap) {
      this.minimap = document.createElement('canvas');
      this.minimap.setAttribute('aria-hidden', 'true');
      this.minimap.style.cssText =
        'position:absolute;border:1px solid #bbb;pointer-events:none;border-radius:4px;';
      this.canvas.element.append(this.minimap);
      this.setMinimapPosition(this.settings.minimap?.position ?? 'bottom-right');
    }
    this.minimap.hidden = false;
    this.drawMinimap();
  }
  hideMinimap(): void {
    if (this.minimap) this.minimap.hidden = true;
  }
  toggleMinimap(): void {
    if (!this.minimap || this.minimap.hidden) this.showMinimap();
    else this.hideMinimap();
  }
  setMinimapPinsEnabled(enabled: boolean): void {
    this.settings.minimap = { ...this.settings.minimap, enabled: true, showCartPins: enabled };
    this.drawMinimap();
  }
  setMinimapPosition(position: MinimapPosition): void {
    this.settings.minimap = {
      ...this.settings.minimap,
      enabled: this.settings.minimap?.enabled ?? false,
      position,
    };
    if (!this.minimap) return;
    const style = this.minimap.style;
    style.top = style.bottom = style.left = style.right = 'auto';
    style[position.startsWith('top') ? 'top' : 'bottom'] = '12px';
    style[position.endsWith('left') ? 'left' : 'right'] = '12px';
  }
  private drawMinimap(): void {
    const canvas = this.minimap,
      bounds = this.schema?.background.viewBox;
    if (!canvas || canvas.hidden || !bounds) return;
    canvas.width = this.settings.minimap?.width ?? 160;
    canvas.height = Math.max(40, Math.round((canvas.width * bounds.height) / bounds.width));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = canvas.width / bounds.width;
    ctx.fillStyle = this.settings.minimap?.backgroundColor ?? '#ffffffdd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x, -bounds.y);
    ctx.fillStyle = '#8f989c';
    for (const seat of this.seats.values()) ctx.fillRect(seat.x, seat.y, 2 / scale, 2 / scale);
    if (this.settings.minimap?.showCartPins !== false) {
      ctx.fillStyle = '#db3b49';
      for (const item of this.cart.seats) {
        const seat = this.seats.get(item.id!);
        if (seat) ctx.fillRect(seat.x - 2 / scale, seat.y - 2 / scale, 4 / scale, 4 / scale);
      }
    }
    const view = this.canvas.getViewport(),
      a = view.toWorld({ x: 0, y: 0 }),
      b = view.toWorld({ x: this.getWidth(), y: this.getHeight() });
    ctx.strokeStyle = this.settings.minimap?.viewportColor ?? '#4597d5';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  protected destroyControls(): void {
    this.cancelAnimation();
    this.minimap?.remove();
    for (const url of this.markerUrls) URL.revokeObjectURL(url);
    this.markerUrls.clear();
    this.markers.clear();
    this.customMarkers.clear();
  }
}
