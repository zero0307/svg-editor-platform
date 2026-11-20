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
export function crosses(a: Point, b: Point, node: ChartNode, gap = 0): boolean {
  // Most nodes lie outside this segment's bounding box on an unrolled graph.
  if (
    Math.max(a.x, b.x) < node.x - gap ||
    Math.min(a.x, b.x) > node.x + node.width + gap ||
    Math.max(a.y, b.y) < node.y - gap ||
    Math.min(a.y, b.y) > node.y + node.height + gap
  )
    return false;
  if (node.shape === 'ellipse' && gap === 0) {
    const rx = node.width / 2,
      ry = node.height / 2;
    const x = (a.x - node.x - rx) / rx,
      y = (a.y - node.y - ry) / ry,
      dx = (b.x - a.x) / rx,
      dy = (b.y - a.y) / ry;
    const norm = dx * dx + dy * dy,
      t = norm ? Math.max(0, Math.min(1, -(x * dx + y * dy) / norm)) : 0;
    return (x + t * dx) ** 2 + (y + t * dy) ** 2 < 1 - epsilon;
  }
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
  if (node.shape === 'ellipse') {
    const rx = node.width / 2,
      ry = node.height / 2,
      cx = node.x + rx,
      cy = node.y + ry;
    const ox = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)),
      oy = ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    return [
      { x: cx - ox, y, dx: -1, dy: 0 },
      { x: cx + ox, y, dx: 1, dy: 0 },
      { x, y: cy - oy, dx: 0, dy: -1 },
      { x, y: cy + oy, dx: 0, dy: 1 },
    ];
  }
  return [
    { x: node.x, y, dx: -1, dy: 0 },
    { x: node.x + node.width, y, dx: 1, dy: 0 },
    { x, y: node.y, dx: 0, dy: -1 },
    { x, y: node.y + node.height, dx: 0, dy: 1 },
  ];
}

function border(node: ChartNode, anchor: Point, dx: number, dy: number): Point {
  if (node.shape === 'ellipse') {
    const rx = node.width / 2,
      ry = node.height / 2,
      px = (anchor.x - node.x - rx) / rx,
      py = (anchor.y - node.y - ry) / ry;
    const vx = dx / rx,
      vy = dy / ry,
      norm = vx * vx + vy * vy,
      dot = px * vx + py * vy;
    const t = (-dot + Math.sqrt(Math.max(0, dot * dot + norm * (1 - px * px - py * py)))) / norm;
    return { x: anchor.x + dx * t, y: anchor.y + dy * t };
  }
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

function chartGutters(chart: Chart) {
  const xs = new Set<number>(),
    ys = new Set<number>();
  for (const n of chart.nodes) {
    xs.add(Math.max(0, n.x - clearance));
    xs.add(Math.min(chart.width, n.x + n.width + clearance));
    ys.add(Math.max(0, n.y - clearance));
    ys.add(Math.min(chart.height, n.y + n.height + clearance));
  }
  return { xs, ys };
}

export function makeEdgeRouter(chart: Chart) {
  let gutters: ReturnType<typeof chartGutters> | undefined;
  const occupied = new Map<string, Set<string>>();
  const mark = (node: ChartNode, point: Point) => {
    const ports = occupied.get(node.id) ?? new Set<string>();
    ports.add(point.x + ',' + point.y);
    occupied.set(node.id, ports);
  };
  return (from: ChartNode, to: ChartNode, fraction: number) => {
    const route = routeEdge(
      chart,
      from,
      to,
      fraction,
      () => (gutters ??= chartGutters(chart)),
      occupied,
    );
    mark(from, route[0]!);
    mark(to, route.at(-1)!);
    return route;
  };
}

export function routeEdge(
  chart: Chart,
  from: ChartNode,
  to: ChartNode,
  fraction: number,
  gutters = () => chartGutters(chart),
  occupied?: ReadonlyMap<string, ReadonlySet<string>>,
): Point[] {
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
  const { xs, ys } = gutters();
  let best: Point[] = [],
    bestCost = Infinity,
    bestCrowding = Infinity;
  function consider(points: Point[]) {
    const path = simplify(points);
    if (
      path.length < 2 ||
      path.some((p) => p.x < 0 || p.y < 0 || p.x > chart.width || p.y > chart.height)
    )
      return;
    let cost = (path.length - 2) * bendPenalty;
    for (let i = 1; i < path.length; i++) cost += distance(path[i - 1]!, path[i]!);
    if (cost > bestCost || (cost === bestCost && bestCrowding === 0)) return;
    const first = path[0]!,
      last = path.at(-1)!;
    const crowding =
      Number(occupied?.get(from.id)?.has(first.x + ',' + first.y) ?? false) +
      Number(occupied?.get(to.id)?.has(last.x + ',' + last.y) ?? false);
    if (
      (cost === bestCost && crowding >= bestCrowding) ||
      !path.slice(1).every((p, i) => clear(path[i]!, p))
    )
      return;
    bestCrowding = crowding;
    bestCost = cost;
    best = path;
  }
  for (const p of ports(from, fraction)) {
    const s = { x: p.x + clearance * p.dx, y: p.y + clearance * p.dy };
    for (const q of ports(to, fraction)) {
      const t = { x: q.x + clearance * q.dx, y: q.y + clearance * q.dy };
      // A valid simplified path has the same length as its raw non-reversing segments.
      const baseX = Math.abs(s.x - t.x) + 2 * clearance,
        baseY = Math.abs(s.y - t.y) + 2 * clearance;
      if (baseX + Math.abs(s.y - t.y) > bestCost + epsilon) continue;
      consider([p, s, { x: s.x, y: t.y }, t, q]);
      consider([p, s, { x: t.x, y: s.y }, t, q]);
      for (const y of ys)
        if (baseX + Math.abs(s.y - y) + Math.abs(t.y - y) <= bestCost + epsilon)
          consider([p, s, { x: s.x, y }, { x: t.x, y }, t, q]);
      for (const x of xs)
        if (baseY + Math.abs(s.x - x) + Math.abs(t.x - x) <= bestCost + epsilon)
          consider([p, s, { x, y: s.y }, { x, y: t.y }, t, q]);
    }
  }
  if (!best.length) {
    const inside = (p: Point) => p.x >= 0 && p.x <= chart.width && p.y >= 0 && p.y <= chart.height;
    const clearCorridor = (p: Point, q: Point) =>
      inside(p) && inside(q) && !chart.nodes.some((n) => crosses(p, q, n, 4));
    best = simplify(
      corridorRoute(
        new Set(xs),
        new Set(ys),
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
