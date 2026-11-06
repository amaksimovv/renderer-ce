import type { MapOutline } from '../src/types';

export type DemoOutline = MapOutline & { section: string };

export function theatreOutlines(): DemoOutline[] {
  return [
    { id: 'stalls-left', label: 'Stalls · left', x: 47, y: 84, width: 117, height: 217 },
    { id: 'stalls-centre', label: 'Stalls · centre', x: 177, y: 78, width: 240, height: 217 },
    { id: 'stalls-right', label: 'Stalls · right', x: 432, y: 84, width: 122, height: 217 },
    { id: 'balcony-left', label: 'Balcony · left', x: 47, y: 339, width: 117, height: 116 },
    { id: 'balcony-centre', label: 'Balcony · centre', x: 177, y: 333, width: 240, height: 116 },
    { id: 'balcony-right', label: 'Balcony · right', x: 432, y: 339, width: 122, height: 116 },
  ].map(({ id, label, x, y, width, height }) => ({
    id,
    label,
    section: id.startsWith('balcony') ? 'Balcony' : 'Stalls',
    bounds: { x, y, width, height },
    path: `M${x + 8} ${y}H${x + width - 8}Q${x + width} ${y} ${x + width} ${y + 8}V${y + height - 8}Q${x + width} ${y + height} ${x + width - 8} ${y + height}H${x + 8}Q${x} ${y + height} ${x} ${y + height - 8}V${y + 8}Q${x} ${y} ${x + 8} ${y}Z`,
    fill: id.startsWith('balcony') ? '#e9e8ed' : '#e8ece1',
    stroke: '#c5cdbb',
  }));
}

export function arenaOutlines(): DemoOutline[] {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4;
    const point = (radius: number, offset: number) => ({
      x: 525 + Math.cos(angle + offset) * radius * 1.5,
      y: 525 + Math.sin(angle + offset) * radius * 1.5,
    });
    const startInner = point(128, -0.36);
    const startOuter = point(292, -0.36);
    const endOuter = point(292, 0.36);
    const endInner = point(128, 0.36);
    const points = [startInner, startOuter, endOuter, endInner, point(292, 0), point(128, 0)];
    const x = Math.min(...points.map((p) => p.x));
    const y = Math.min(...points.map((p) => p.y));
    return {
      id: `section-${index + 1}`,
      section: `Section ${index + 1}`,
      label: `Section ${index + 1}`,
      bounds: {
        x,
        y,
        width: Math.max(...points.map((p) => p.x)) - x,
        height: Math.max(...points.map((p) => p.y)) - y,
      },
      path: `M${startInner.x} ${startInner.y}L${startOuter.x} ${startOuter.y}A438 438 0 0 1 ${endOuter.x} ${endOuter.y}L${endInner.x} ${endInner.y}A192 192 0 0 0 ${startInner.x} ${startInner.y}Z`,
      fill: index % 2 === 0 ? '#e6ebdf' : '#eaece3',
      stroke: '#b8c4ac',
    };
  });
}
