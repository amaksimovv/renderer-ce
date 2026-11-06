import type { BackgroundStatus, Bounds, SvgBackground } from './types.js';

export function normalizeSvg(source: string, bounds: Bounds): string {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (
    document.querySelector('parsererror') ||
    document.doctype ||
    root.localName !== 'svg' ||
    (root.namespaceURI && root.namespaceURI !== 'http://www.w3.org/2000/svg')
  ) {
    throw new TypeError('Background must be a valid SVG document');
  }
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!root.hasAttribute('viewBox')) {
    root.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  }
  root.setAttribute('width', String(bounds.width));
  root.setAttribute('height', String(bounds.height));
  root.setAttribute('preserveAspectRatio', 'none');
  return new XMLSerializer().serializeToString(root);
}

function decodeImage(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    const settle = (error?: Error) => {
      image.onload = image.onerror = null;
      signal.removeEventListener('abort', abort);
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(image);
    };
    const abort = () => {
      settle(new DOMException('SVG loading cancelled', 'AbortError'));
      image.src = '';
    };
    image.onerror = () => settle(new Error('Unable to decode SVG background'));
    image.onload = () => settle();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else image.src = url;
  });
}

export class SvgBackgroundLayer {
  image: HTMLImageElement | undefined;
  status: BackgroundStatus = 'empty';
  private source: SvgBackground | undefined;
  private controller: AbortController | undefined;

  constructor(
    private readonly changed: (status: BackgroundStatus) => void,
    private readonly failed?: (error: Error) => void,
  ) {}

  set(source: SvgBackground | undefined): void {
    const previous = this.source;
    this.source = source;
    if (
      previous &&
      source &&
      previous.svg === source.svg &&
      previous.url === source.url &&
      previous.bounds.width === source.bounds.width &&
      previous.bounds.height === source.bounds.height
    )
      return;
    this.clear();
    if (!source) {
      this.changeStatus('empty');
      return;
    }
    this.controller = new AbortController();
    this.changeStatus('loading');
    void this.load(source, this.controller.signal);
  }

  destroy(): void {
    this.clear();
    this.source = undefined;
  }

  private clear(): void {
    this.controller?.abort();
    this.controller = undefined;
    if (this.image) this.image.src = '';
    this.image = undefined;
  }

  private changeStatus(status: BackgroundStatus): void {
    this.status = status;
    this.changed(status);
  }

  private async load(source: SvgBackground, signal: AbortSignal): Promise<void> {
    try {
      let svg = source.svg;
      if (svg === undefined) {
        if (source.url === undefined) throw new TypeError('Missing SVG background URL');
        const url = new URL(source.url, document.baseURI);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new TypeError('SVG background URLs must use HTTP or HTTPS');
        }
        const response = await fetch(url, { signal, credentials: 'omit' });
        if (!response.ok)
          throw new Error(`Unable to load SVG background (HTTP ${response.status})`);
        svg = await response.text();
      }
      if (signal.aborted) return;
      const image = await decodeImage(normalizeSvg(svg, source.bounds), signal);
      if (signal.aborted) {
        image.src = '';
        return;
      }
      this.image = image;
      this.changeStatus('ready');
    } catch (error) {
      if (signal.aborted) return;
      this.changeStatus('error');
      this.failed?.(error instanceof Error ? error : new Error('Unable to load SVG background'));
    }
  }
}
