import type { artworkTargets } from './artworkTargets.js';
import type { EdgeTarget } from './edgeTargets.js';
import type { ChartNode } from './flowchart.js';
import type { Point } from './edgeRouting.js';
type Nodes = ReadonlyArray<
  Pick<ReturnType<typeof artworkTargets>[number], 'id' | 'title' | 'shape' | 'geometry'>
>;
const number = /[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g;
export function endpoints(edge: EdgeTarget): Point[] {
  const { shape, geometry: g } = edge.parts[0]!;
  if (shape === 'line')
    return [
      { x: Number(g.x1), y: Number(g.y1) },
      { x: Number(g.x2), y: Number(g.y2) },
    ];
  if (shape === 'polyline') {
    const v = (g.points ?? '').match(number)?.map(Number) ?? [];
    return v.length >= 4 && v.length % 2 === 0
      ? [
          { x: v[0]!, y: v[1]! },
          { x: v.at(-2)!, y: v.at(-1)! },
        ]
      : [];
  }
  // Only infer endpoints for single open subpaths. Unsupported syntax requires explicit IDs.
  const path = g.d ?? '';
  const segments = /([mMlLhHvVcCsSqQtTaA])([^mMlLhHvVcCsSqQtTaAzZ]*)/g;
  let x = 0,
    y = 0,
    consumed = 0,
    start: Point | undefined;
  for (const m of path.trim().matchAll(segments)) {
    if (m.index !== consumed) return [];
    consumed += m[0].length;
    const cmd = m[1]!,
      op = cmd.toUpperCase(),
      relative = cmd !== op;
    if ((!start && op !== 'M') || (start && op === 'M')) return [];
    const size = (
      { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 } as Record<string, number>
    )[op]!;
    const args = m[2]!;
    if (args.replace(number, '').replace(/[\s,]/g, '')) return [];
    const v = (args.match(number) ?? []).map(Number);
    if (!v.length || v.length % size || !v.every(Number.isFinite)) return [];
    for (let i = size; i <= v.length; i += size) {
      if (op !== 'V') x = (relative ? x : 0) + v[i - (op === 'H' ? 1 : 2)]!;
      if (op !== 'H') y = (relative ? y : 0) + v[i - 1]!;
      start ??= { x, y };
    }
  }
  return start && consumed === path.trim().length ? [start, { x, y }] : [];
}

export function artworkBoxes(nodes: Nodes): ChartNode[] {
  return nodes
    .filter((n) => !n.geometry.transform)
    .map((n) => {
      const g = n.geometry;
      if (n.shape === 'rect')
        return {
          id: n.id,
          label: n.title,
          shape: 'box',
          x: Number(g.x),
          y: Number(g.y),
          width: Number(g.width),
          height: Number(g.height),
        };
      const rx = Number(g.rx ?? g.r),
        ry = Number(g.ry ?? g.r);
      return {
        id: n.id,
        label: n.title,
        shape: 'ellipse',
        x: Number(g.cx) - rx,
        y: Number(g.cy) - ry,
        width: 2 * rx,
        height: 2 * ry,
      };
    });
}

export function nearbyEnds(edge: EdgeTarget, nodes: ChartNode[]) {
  if (edge.parts[0]?.geometry.transform) return {};
  const nearest = (p: Point) => {
    const hits = nodes.filter((n) => {
      const dx = Math.abs(p.x - n.x - n.width / 2),
        dy = Math.abs(p.y - n.y - n.height / 2);
      if (n.shape === 'ellipse') {
        const radius = Math.hypot(dx / (n.width / 2), dy / (n.height / 2));
        if (!radius) return false;
        return Math.abs(1 - 1 / radius) * Math.hypot(dx, dy) <= 16;
      }
      const ex = dx - n.width / 2,
        ey = dy - n.height / 2;
      return (
        Math.abs(Math.hypot(Math.max(ex, 0), Math.max(ey, 0)) + Math.min(Math.max(ex, ey), 0)) <= 16
      );
    });
    if (hits.length === 1) return hits[0]!.id;
  };
  const [a, b] = endpoints(edge);
  return { from: a && nearest(a), to: b && nearest(b) };
}
