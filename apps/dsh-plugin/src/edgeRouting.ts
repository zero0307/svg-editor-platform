import { corridorRoute } from './corridorRoute.js';
import type { ChartNode, Chart } from './flowchart.js';

export interface Point {
  x: number;
  y: number;
}
const clearance = 10;
// A simple three-segment detour should beat a shorter path with crowded arrowheads.
const bendPenalty = 56;
const epsilon = 1e-7;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

// Clip a segment against the open interior. Touching a node at its port is allowed.
function crosses(a: Point, b: Point, node: ChartNode, gap = 0): boolean {
  let enter = 0,
    leave = 1;
  for (const [start, delta, low, high] of [
    [a.x, b.x - a.x, node.x - gap, node.x + node.width + gap],
    [a.y, b.y - a.y, node.y - gap, node.y + node.height + gap],
  ] as const) {
    if (Math.abs(delta) < epsilon) {
      if (start <= low + epsilon || start >= high - epsilon) return false;
    } else {
      const t1 = (low + epsilon - start) / delta;
      const t2 = (high - epsilon - start) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
    }
  }
  return enter < leave;
}

function ports(node: ChartNode, fraction: number) {
  const radius = Math.min(13, node.width / 4, node.height / 4);
  const x = node.x + radius + fraction * (node.width - 2 * radius),
    y = node.y + radius + fraction * (node.height - 2 * radius);
  return [
    { x: node.x, y, dx: -1, dy: 0 },
    { x: node.x + node.width, y, dx: 1, dy: 0 },
    { x, y: node.y, dx: 0, dy: -1 },
    { x, y: node.y + node.height, dx: 0, dy: 1 },
  ];
}

function border(node: ChartNode, anchor: Point, dx: number, dy: number): Point {
  const tx = dx === 0 ? Infinity : ((dx > 0 ? node.x + node.width : node.x) - anchor.x) / dx;
  const ty = dy === 0 ? Infinity : ((dy > 0 ? node.y + node.height : node.y) - anchor.y) / dy;
  const t = Math.min(tx, ty);
  const p = { x: anchor.x + t * dx, y: anchor.y + t * dy };
  const radius = Math.min(13, node.width / 4, node.height / 4);
  if (tx < ty) p.y = Math.max(node.y + radius, Math.min(node.y + node.height - radius, p.y));
  else p.x = Math.max(node.x + radius, Math.min(node.x + node.width - radius, p.x));
  return p;
}

function simplify(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const b = result.at(-1);
    if (b && distance(b, p) < epsilon) continue;
    const a = result.at(-2);
    if (a && b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) {
      if ((b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < 0) return [];
      result.pop();
    }
    result.push(p);
  }
  return result;
}

export function routeEdge(chart: Chart, from: ChartNode, to: ChartNode, fraction: number): Point[] {
  // Nested or coincident node bodies cannot have visually distinct endpoints.
  const encloses = (outer: ChartNode, inner: ChartNode) =>
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height;
  if (encloses(from, to) || encloses(to, from))
    throw new RangeError(`Cannot route ${from.id} to ${to.id}: separate the overlapping nodes.`);
  const horizontal =
    Math.abs(from.x + from.width / 2 - to.x - to.width / 2) >=
    Math.abs(from.y + from.height / 2 - to.y - to.height / 2);
  const anchor = (n: ChartNode) => ({
    x: n.x + n.width * (horizontal ? 0.5 : fraction),
    y: n.y + n.height * (horizontal ? fraction : 0.5),
  });
  const a = anchor(from),
    b = anchor(to),
    dx = b.x - a.x,
    dy = b.y - a.y;
  const clear = (p: Point, q: Point) =>
    !chart.nodes.some((n) => crosses(p, q, n, n === from || n === to ? 0 : 4));
  if (dx || dy) {
    const p = border(from, a, dx, dy),
      q = border(to, b, -dx, -dy);
    if ((q.x - p.x) * dx + (q.y - p.y) * dy > 0 && clear(p, q)) return [p, q];
  }

  // Search gutters bordering the rectangles. Stubs force a clean exit and entry at each port.
  const xs = new Set<number>(),
    ys = new Set<number>();
  for (const n of chart.nodes) {
    xs.add(Math.max(0, n.x - clearance));
    xs.add(Math.min(chart.width, n.x + n.width + clearance));
    ys.add(Math.max(0, n.y - clearance));
    ys.add(Math.min(chart.height, n.y + n.height + clearance));
  }
  let best: Point[] = [],
    bestCost = Infinity;
  function consider(points: Point[]) {
    const path = simplify(points);
    if (
      path.length < 2 ||
      path.some((p) => p.x < 0 || p.y < 0 || p.x > chart.width || p.y > chart.height)
    )
      return;
    let cost = (path.length - 2) * bendPenalty;
    for (let i = 1; i < path.length; i++) cost += distance(path[i - 1]!, path[i]!);
    if (cost >= bestCost || !path.slice(1).every((p, i) => clear(path[i]!, p))) return;
    bestCost = cost;
    best = path;
  }
  for (const p of ports(from, fraction)) {
    const s = { x: p.x + clearance * p.dx, y: p.y + clearance * p.dy };
    for (const q of ports(to, fraction)) {
      const t = { x: q.x + clearance * q.dx, y: q.y + clearance * q.dy };
      consider([p, s, { x: s.x, y: t.y }, t, q]);
      consider([p, s, { x: t.x, y: s.y }, t, q]);
      for (const y of ys) consider([p, s, { x: s.x, y }, { x: t.x, y }, t, q]);
      for (const x of xs) consider([p, s, { x, y: s.y }, { x, y: t.y }, t, q]);
    }
  }
  if (!best.length) {
    const inside = (p: Point) => p.x >= 0 && p.x <= chart.width && p.y >= 0 && p.y <= chart.height;
    const clearCorridor = (p: Point, q: Point) =>
      inside(p) && inside(q) && !chart.nodes.some((n) => crosses(p, q, n, 4));
    best = simplify(
      corridorRoute(
        xs,
        ys,
        ports(from, fraction),
        ports(to, fraction),
        clearance,
        inside,
        clear,
        clearCorridor,
      ),
    );
  }
  if (!best.length)
    throw new RangeError(
      'No clear connector route from ' +
        from.id +
        ' to ' +
        to.id +
        '. Increase node spacing or canvas margins.',
    );
  return best;
}

export function arrowWings(previous: Point, tip: Point): Point[] {
  const length = distance(previous, tip);
  const dx = (tip.x - previous.x) / length,
    dy = (tip.y - previous.y) / length;
  const size = Math.min(8, length * 0.7);
  return [-1, 1].map((side) => ({
    x: tip.x - size * dx + side * size * 0.45 * dy,
    y: tip.y - size * dy - side * size * 0.45 * dx,
  }));
}
