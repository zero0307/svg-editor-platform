import type { Point } from './edgeRouting.js';
import type { Span } from './curveRoute.js';

export interface Segment {
  start: Point;
  end: Point;
}
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Flatten only the neighbouring stroke. The candidate quadratic is intersected
// analytically, so a bowed line can hit the same straight segment twice.
export function flattenCubic(
  a: Point,
  first: Point,
  second: Point,
  b: Point,
  out: Segment[],
  depth = 0,
) {
  if (
    depth >= 10 ||
    Math.max(distance(first, mix(a, b, 1 / 3)), distance(second, mix(a, b, 2 / 3))) <= 0.2
  ) {
    out.push({ start: a, end: b });
    return;
  }
  const left = mix(a, first, 0.5),
    middle = mix(first, second, 0.5),
    right = mix(second, b, 0.5);
  const c = mix(left, middle, 0.5),
    d = mix(middle, right, 0.5),
    cut = mix(c, d, 0.5);
  flattenCubic(a, left, c, cut, out, depth + 1);
  flattenCubic(cut, d, right, b, out, depth + 1);
}
export function addSpanSegments(span: Span, out: Segment[]) {
  const { start, end, control } = span;
  if (control) flattenCubic(start, mix(start, control, 2 / 3), mix(end, control, 2 / 3), end, out);
  else out.push({ start, end });
}

export function crossingCount(
  a: Point,
  c: Point,
  b: Point,
  neighbours: readonly Segment[],
  limit = Infinity,
) {
  const minX = Math.min(a.x, c.x, b.x),
    maxX = Math.max(a.x, c.x, b.x);
  const minY = Math.min(a.y, c.y, b.y),
    maxY = Math.max(a.y, c.y, b.y);
  const hits: number[] = [];
  // Multiple pieces can share a vertex. Count that visible contact once;
  // shared attachment points at the two ends of the candidate are intentional.
  const add = (t: number) => {
    if (t > 1e-8 && t < 1 - 1e-8 && !hits.some((s) => Math.abs(s - t) < 1e-7)) hits.push(t);
  };
  for (const { start, end } of neighbours) {
    if (
      (start.x < minX && end.x < minX) ||
      (start.x > maxX && end.x > maxX) ||
      (start.y < minY && end.y < minY) ||
      (start.y > maxY && end.y > maxY)
    )
      continue;
    const dx = end.x - start.x,
      dy = end.y - start.y,
      length = Math.hypot(dx, dy);
    if (!length) continue;
    const nx = -dy / length,
      ny = dx / length;
    const signed = (p: Point) => (p.x - start.x) * nx + (p.y - start.y) * ny;
    const p = signed(a),
      q = signed(c),
      r = signed(b);
    if ((p > 0 && q > 0 && r > 0) || (p < 0 && q < 0 && r < 0)) continue;
    const A = p - 2 * q + r,
      B = 2 * (q - p);
    const accept = (t: number) => {
      if (t <= 0 || t >= 1) return;
      const s = 1 - t,
        x = s * s * a.x + 2 * s * t * c.x + t * t * b.x,
        y = s * s * a.y + 2 * s * t * c.y + t * t * b.y;
      const projection = ((x - start.x) * dx + (y - start.y) * dy) / (length * length);
      if (projection >= -1e-9 && projection <= 1 + 1e-9) add(t);
    };
    if (Math.abs(A) < 1e-10) {
      if (Math.abs(B) > 1e-10) accept(-p / B);
    } else {
      const discriminant = B * B - 4 * A * p;
      if (discriminant >= 0) {
        const square = Math.sqrt(discriminant);
        accept((-B - square) / (2 * A));
        accept((-B + square) / (2 * A));
      }
    }
    if (hits.length >= limit) break;
  }
  return hits.length;
}
