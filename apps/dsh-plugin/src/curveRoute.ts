import type { Chart, ChartNode } from './flowchart.js';
import { arrowWings, crosses, type Point, type Bounds } from './edgeRouting.js';

import { crossingCount, type Segment } from './connectorCrossings.js';

export type ConnectorStyle = 'angular' | 'rounded' | 'arc';
export interface Span {
  start: Point;
  end: Point;
  control?: Point;
}
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function towards(a: Point, b: Point, length: number): Point {
  const f = length / distance(a, b);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

// Each half of a quadratic lies inside the hull of its three control points.
// Reject uncertain intersections at the recursion limit, keeping the known clear polyline.
export function clearOf(
  a: Point,
  c: Point,
  b: Point,
  node: Bounds,
  gap: number,
  depth = 0,
): boolean {
  if (
    Math.max(a.x, b.x, c.x) <= node.x - gap ||
    Math.min(a.x, b.x, c.x) >= node.x + node.width + gap ||
    Math.max(a.y, b.y, c.y) <= node.y - gap ||
    Math.min(a.y, b.y, c.y) >= node.y + node.height + gap
  )
    return true;
  if (depth === 9) return false;
  const left = mid(a, c),
    right = mid(c, b),
    center = mid(left, right);
  return (
    clearOf(a, left, center, node, gap, depth + 1) &&
    clearOf(center, right, b, node, gap, depth + 1)
  );
}

export function shapeRoute(
  route: Point[],
  style: ConnectorStyle,
  chart: Chart,
  from: ChartNode,
  to: ChartNode,
  neighbours: readonly Segment[] = [],
): Span[] {
  const straight = () => route.slice(1).map((end, i) => ({ start: route[i]!, end }));
  if (style === 'angular') return straight();
  const safe = (start: Point, control: Point, end: Point) =>
    [start, control, end].every(
      (p) => p.x >= 0 && p.x <= chart.width && p.y >= 0 && p.y <= chart.height,
    ) && chart.nodes.every((n) => clearOf(start, control, end, n, n === from || n === to ? 0 : 4));
  const first = route[0]!,
    last = route.at(-1)!,
    length = distance(first, last);
  if (style === 'arc' && length > 8) {
    const center = mid(first, last),
      nx = (last.y - first.y) / length,
      ny = (first.x - last.x) / length;
    const lead = route[1]!;
    const preferred =
      route.length > 2 && (lead.x - first.x) * nx + (lead.y - first.y) * ny < 0 ? -1 : 1;
    const bow = route.length > 2 ? Math.min(150, length * 0.72) : Math.min(90, length * 0.32);
    let best: Span | undefined,
      fewest = Infinity;
    // Preserve the original bend on ties. Try shallower bows when neighbouring
    // strokes occupy both sides of the preferred route.
    for (const scales of [[1, 0.55], ...(neighbours.length ? [[0.3, 0.18]] : [])])
      for (const sign of [preferred, -preferred])
        for (const scale of scales) {
          const control = {
            x: center.x + sign * scale * bow * nx,
            y: center.y + sign * scale * bow * ny,
          };
          if (
            safe(first, control, last) &&
            arrowWings(control, last).every(
              (wing) =>
                wing.x >= 0 &&
                wing.x <= chart.width &&
                wing.y >= 0 &&
                wing.y <= chart.height &&
                !chart.nodes.some((n) => crosses(wing, last, n)),
            )
          ) {
            const candidate = { start: first, control, end: last };
            const count = crossingCount(first, control, last, neighbours, fewest);
            if (count === 0) return [candidate];
            if (count < fewest) {
              fewest = count;
              best = candidate;
            }
          }
        }
    if (best) return [best];
  }
  const spans: Span[] = [];
  let cursor = first;
  const line = (end: Point) => {
    if (distance(cursor, end) > 0) spans.push({ start: cursor, end });
    cursor = end;
  };
  for (let i = 1; i < route.length - 1; i++) {
    const prev = route[i - 1]!,
      corner = route[i]!,
      next = route[i + 1]!;
    const radius = Math.min(24, distance(prev, corner) * 0.45, distance(corner, next) * 0.45);
    const enter = towards(corner, prev, radius),
      exit = towards(corner, next, radius);
    if (safe(enter, corner, exit)) {
      line(enter);
      spans.push({ start: enter, control: corner, end: exit });
      cursor = exit;
    } else line(corner);
  }
  line(last);
  return spans;
}

export type EditConnectorStyle = ConnectorStyle | 'straight';

// Creation may choose a fallback; an explicit edit must actually produce the requested shape.
export function verifyEditStyle(
  style: EditConnectorStyle | undefined,
  parts: number,
  curves: number,
) {
  if (!style) return;
  if (style === 'straight' && (parts !== 1 || curves !== 0))
    throw new RangeError('A clear straight connection is unavailable. Choose angular or rounded.');
  if (style === 'arc' && (parts !== 1 || curves !== 1))
    throw new RangeError('A clear single arc is unavailable. Choose rounded or another endpoint.');
  if (style === 'rounded' && curves === 0)
    throw new RangeError('No clear corner to round. Choose arc for a curved direct connection.');
}
