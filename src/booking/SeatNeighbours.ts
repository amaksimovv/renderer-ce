import type { ICartChangeResult, ISeat } from './models.js';

type Adjacent = Map<number, number[]>;
type Membership = (id: number) => boolean;

function typical(spacing: number[]): number {
  spacing.sort((left, right) => left - right);
  return spacing[(spacing.length - 1) >>> 1] ?? 0;
}

function rowGeometry(row: ISeat[]) {
  const extent = (axis: 'x' | 'y') => {
    let lo = Infinity,
      hi = -Infinity;
    for (const seat of row) {
      lo = Math.min(lo, seat[axis]);
      hi = Math.max(hi, seat[axis]);
    }
    return hi - lo;
  };
  const axis = extent('x') >= extent('y') ? 'x' : 'y';
  row.sort((left, right) => left[axis] - right[axis] || left.id - right.id);
  const edges = row.slice(1).map((end, i) => ({
    from: row[i]!.id,
    to: end.id,
    length: Math.hypot(end.x - row[i]!.x, end.y - row[i]!.y),
  }));
  return { edges, pitch: typical(edges.map((edge) => edge.length)) };
}

function indexNeighbours(seats: Map<number, ISeat>): Adjacent {
  const byRow = new Map<number, ISeat[]>();
  const links: Adjacent = new Map();
  for (const seat of seats.values()) {
    const row = byRow.get(seat.rowId);
    if (row) row.push(seat);
    else byRow.set(seat.rowId, [seat]);
    links.set(seat.id, []);
  }
  const rows = Array.from(byRow.values(), rowGeometry);
  const venue = typical(rows.flatMap((row) => row.edges.map((edge) => edge.length)));
  for (const { edges, pitch } of rows) {
    const threshold = venue && pitch > 3 * venue ? 3 * venue : pitch ? 1.5 * pitch : Infinity;
    for (const { from, to, length } of edges) {
      if (length > threshold) continue;
      links.get(from)!.push(to);
      links.get(to)!.push(from);
    }
  }
  return links;
}

export class SeatNeighbours {
  private readonly links: Adjacent;
  constructor(readonly seats: Map<number, ISeat>) {
    this.links = indexNeighbours(seats);
  }
  private isolated(id: number, member: Membership): boolean {
    const nearby = this.links.get(id);
    return !!nearby && member(id) && !nearby.some(member);
  }
  private vicinity(ids: Iterable<number>): Set<number> {
    const result = new Set<number>();
    for (const id of ids) {
      result.add(id);
      for (const adjacent of this.links.get(id) ?? []) result.add(adjacent);
    }
    return result;
  }
  check(selecting: boolean, ids: number[], cart: number[], blocked: Membership): ICartChangeResult {
    const held = new Set(cart);
    const open: Membership = (id) => {
      const seat = this.seats.get(id);
      return !!seat?.priceId && !seat.locked && seat.state !== 'unavailable';
    };
    const initiallyFree: Membership = (id) => open(id) && !held.has(id);
    const changed = new Set(ids);
    const extra = new Set<number>();
    const free: Membership = (id) => (changed.has(id) ? !selecting : initiallyFree(id));
    const ascending = (a: number, b: number) => a - b;
    const newlyAlone = () =>
      Array.from(this.vicinity(changed))
        .filter(
          (id) =>
            this.isolated(id, free) &&
            !this.isolated(id, initiallyFree) &&
            !this.isolated(id, open),
        )
        .sort(ascending);
    const orphaned = newlyAlone();
    if (!orphaned.length) return { applied: true, orphaned, remedy: null };
    let pending = orphaned;
    for (let attempt = 1; attempt < 10; attempt++) {
      if (selecting) {
        for (const id of pending) {
          extra.add(id);
          changed.add(id);
        }
      } else {
        const candidates = new Set(pending.flatMap((id) => this.links.get(id) ?? []));
        let best: number | undefined;
        let lowest = Infinity;
        const retained: Membership = (id) => held.has(id) && !changed.has(id);
        for (const id of candidates) {
          if (!held.has(id) || extra.has(id)) continue;
          const without: Membership = (other) => other !== id && retained(other);
          let delta = 0;
          for (const near of this.vicinity([id])) {
            delta += Number(this.isolated(near, without)) - Number(this.isolated(near, retained));
          }
          if (delta < lowest) {
            lowest = delta;
            best = id;
          }
        }
        if (best === undefined) break;
        changed.add(best);
        extra.add(best);
      }
      pending = newlyAlone();
      if (!pending.length) {
        const suggestion = Array.from(extra).sort(ascending);
        const remedy = selecting
          ? suggestion.some(blocked)
            ? null
            : { select: suggestion, deselect: [] }
          : { select: [], deselect: suggestion };
        return { applied: false, orphaned, remedy };
      }
    }
    return { applied: false, orphaned, remedy: null };
  }
}
