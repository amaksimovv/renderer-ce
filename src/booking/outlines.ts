import type { Bounds, MapOutline, Point } from '../types.js';
import type { ISector, ISeat } from './models.js';

const ns = 'http://www.w3.org/2000/svg';
const attributes = [
  'd',
  'points',
  'x',
  'y',
  'width',
  'height',
  'rx',
  'ry',
  'cx',
  'cy',
  'r',
  'transform',
];

function pathData(element: Element): string | undefined {
  const n = (key: string) => Number(element.getAttribute(key) ?? 0);
  switch (element.localName) {
    case 'path':
      return element.getAttribute('d') ?? undefined;
    case 'polygon':
    case 'polyline':
      return `M ${element.getAttribute('points') ?? ''} Z`;
    case 'rect': {
      const x = n('x'),
        y = n('y'),
        w = n('width'),
        h = n('height');
      const r = Math.min(n('rx') || n('ry'), w / 2, h / 2);
      return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    }
    case 'circle':
    case 'ellipse': {
      const x = n('cx'),
        y = n('cy'),
        rx = n('r') || n('rx'),
        ry = n('r') || n('ry');
      return `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
    }
    default:
      return undefined;
  }
}

export function svgOutlines(source: string | undefined, sections: ISector[]): MapOutline[] {
  if (!source) return [];
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid outline SVG');
  const svg = document.createElementNS(ns, 'svg');
  svg.style.cssText =
    'position:absolute;width:1px;height:1px;visibility:hidden;pointer-events:none';
  svg.setAttribute('aria-hidden', 'true');
  document.body.append(svg);
  const result: MapOutline[] = [];
  try {
    const candidates = doc.querySelectorAll('path,rect,polygon,polyline,circle,ellipse');
    for (const element of candidates) {
      const bound = element.closest('[data-gos-id],[data-section-id],[data-gos-guid]');
      if (!bound || element.closest('defs')) continue;
      const section = sections.find(
        (s) =>
          String(s.id) ===
            (bound.getAttribute('data-gos-id') ?? bound.getAttribute('data-section-id')) ||
          (!!s.guid && s.guid === bound.getAttribute('data-gos-guid')),
      );
      const d = pathData(element);
      if (!section || !d) continue;
      const geometry = document.createElementNS(ns, element.localName) as SVGGraphicsElement;
      for (const name of attributes) {
        const value = element.getAttribute(name);
        if (value !== null) geometry.setAttribute(name, value);
      }
      const ancestors: Element[] = [];
      for (
        let parent = element.parentElement;
        parent && parent.localName !== 'svg';
        parent = parent.parentElement
      )
        ancestors.unshift(parent);
      let host: Element = svg;
      for (const parent of ancestors) {
        const group = document.createElementNS(ns, 'g');
        group.setAttribute('transform', parent.getAttribute('transform') ?? '');
        host.append(group);
        host = group;
      }
      host.append(geometry);
      const b = geometry.getBBox(),
        matrix = geometry.getCTM() ?? new DOMMatrix();
      const corners = [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x, b.y + b.height],
        [b.x + b.width, b.y + b.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
      const x = Math.min(...corners.map((p) => p.x)),
        y = Math.min(...corners.map((p) => p.y));
      result.push({
        source:
          bound.getAttribute('data-outline-source') === 'generated' ||
          bound.classList.contains('sm-outline-auto')
            ? 'auto'
            : bound.getAttribute('data-outline-source') === 'fallback'
              ? 'fallback'
              : bound.getAttribute('data-outline-source') === 'svg' || bound.localName === 'path'
                ? 'svg'
                : 'shape',
        id: `${section.id}:${result.length}`,
        label: section.name,
        path: d,
        transform: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
        bounds: {
          x,
          y,
          width: Math.max(1, Math.max(...corners.map((p) => p.x)) - x),
          height: Math.max(1, Math.max(...corners.map((p) => p.y)) - y),
        },
        fill: 'transparent',
        stroke: 'none',
        fillRule: element.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero',
      });
      svg.replaceChildren();
    }
  } finally {
    svg.remove();
  }
  return result;
}

export function fallbackOutlines(
  seats: ISeat[],
  sections: ISector[],
  existing: MapOutline[],
): MapOutline[] {
  const bySection = new Map<number, Point[]>();
  for (const seat of seats) {
    const group = bySection.get(seat.sectorId) ?? [];
    group.push(seat);
    bySection.set(seat.sectorId, group);
  }
  return sections.flatMap((section) => {
    if (existing.some((outline) => outline.id.startsWith(`${section.id}:`))) return [];
    const points = (bySection.get(section.id) ?? []).flatMap((p) => [
      { x: p.x - 12, y: p.y - 12 },
      { x: p.x + 12, y: p.y + 12 },
      { x: p.x - 12, y: p.y + 12 },
      { x: p.x + 12, y: p.y - 12 },
    ]);
    if (!points.length) return [];
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o: Point, a: Point, b: Point) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (list: Point[]) => {
      const hull: Point[] = [];
      for (const p of list) {
        while (hull.length >= 2 && cross(hull[hull.length - 2]!, hull[hull.length - 1]!, p) <= 0)
          hull.pop();
        hull.push(p);
      }
      hull.pop();
      return hull;
    };
    const hull = [...half(points), ...half([...points].reverse())];
    const bounds = pointBounds(points);
    return [
      {
        id: `${section.id}:fallback`,
        source: 'fallback',
        label: section.name,
        path: `M${hull.map((p) => `${p.x} ${p.y}`).join('L')}Z`,
        bounds,
        fill: 'transparent',
        stroke: 'none',
      },
    ];
  });
}

export function pointBounds(points: readonly Point[]): Bounds {
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
  }
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}
