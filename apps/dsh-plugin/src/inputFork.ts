import { crosses, arrowWings, type Point, type Bounds } from './edgeRouting.js';
import { fontSize, wrapLabel } from './chartText.js';
import { clearOf, type Span } from './curveRoute.js';
import type { Chart, ChartNode } from './flowchart.js';

export interface ForkPort {
  name: string;
  base: Point;
  tip: Point;
  text: Point;
  ink: Bounds;
}

// Attach a perpendicular bus to the end of a routed trunk. Labels follow the
// last approach so the same notation also works for horizontal diagrams.
export function inputFork(
  route: Point[],
  names: readonly string[],
  source: ChartNode,
  target: ChartNode,
  chart: Chart,
) {
  const tip = route.at(-1)!,
    previous = route.at(-2)!;
  const fail = () => new RangeError('Leave more room for named input ports on ' + target.id + '.');
  if (target.shape === 'ellipse')
    throw new RangeError('Named input ports require a box target: ' + target.id);
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const dx = eq(tip.x, target.x) ? 1 : eq(tip.x, target.x + target.width) ? -1 : 0;
  const dy = dx ? 0 : eq(tip.y, target.y) ? 1 : eq(tip.y, target.y + target.height) ? -1 : 0;
  const distance = (tip.x - previous.x) * dx + (tip.y - previous.y) * dy;
  const widths = names.map((name) => (wrapLabel(name, Infinity)[0]!.width * 11) / fontSize);
  const desiredDepth = dx ? widths.reduce((depth, w) => Math.max(depth, w + 24), 34) : 34;
  const depth = Math.min(desiredDepth, distance * 0.85);
  if (depth < 18) throw fail();
  const center = { x: tip.x - dx * depth, y: tip.y - dy * depth };
  const available = dx
    ? Math.min(tip.y - target.y, target.y + target.height - tip.y)
    : Math.min(tip.x - target.x, target.x + target.width - tip.x);
  const radius = Math.min(13, target.width / 4, target.height / 4);
  const step =
    names.length === 1 ? 0 : Math.min(38, (2 * (available - radius)) / (names.length - 1));
  if (names.length > 1 && step < 16) throw fail();
  const ports: ForkPort[] = names.map((name, i) => {
    const offset = (i - (names.length - 1) / 2) * step;
    const end = { x: tip.x + (dy ? offset : 0), y: tip.y + (dx ? offset : 0) };
    const base = { x: end.x - dx * depth, y: end.y - dy * depth };
    const width = widths[i]!;
    const text = dx
      ? {
          x: (base.x + end.x - width) / 2 - 2 * dx,
          y: end.y - (chart.autoDirection ? 9 : width > 12 ? 7 : 5),
        }
      : { x: end.x + 7, y: (base.y + end.y) / 2 + 4 };
    return { name, base, tip: end, text, ink: { x: text.x, y: text.y - 11, width, height: 14 } };
  });
  const segments: Span[] = [
    { start: previous, end: center },
    { start: ports[0]!.base, end: ports.at(-1)!.base },
  ];
  for (const p of ports) {
    segments.push({ start: p.base, end: p.tip });
    for (const wing of arrowWings(p.base, p.tip)) segments.push({ start: wing, end: p.tip });
  }
  const onCanvas = (p: Point) => p.x >= 0 && p.x <= chart.width && p.y >= 0 && p.y <= chart.height;
  if (
    segments.some(
      ({ start, end }) =>
        !onCanvas(start) ||
        !onCanvas(end) ||
        chart.nodes.some((n) => crosses(start, end, n, n === target || n === source ? 0 : 3)),
    )
  )
    throw fail();
  for (const { ink } of ports) {
    if (
      !onCanvas(ink) ||
      !onCanvas({ x: ink.x + ink.width, y: ink.y + ink.height }) ||
      chart.nodes.some((n) => nearBox(ink, n))
    )
      throw fail();
  }
  return { trunk: [...route.slice(0, -1), center], ports };
}

function nearBox(a: Bounds, b: Bounds) {
  return (
    a.x < b.x + b.width + 2 &&
    a.x + a.width > b.x - 2 &&
    a.y < b.y + b.height + 2 &&
    a.y + a.height > b.y - 2
  );
}

// Check even connectors drawn after the fork, across the entire diagram.
export function checkPortLabels(labels: readonly ForkPort[], spans: readonly Span[]) {
  for (const [i, port] of labels.entries()) {
    if (
      labels.some((other, j) => j < i && nearBox(port.ink, other.ink)) ||
      spans.some(({ start, end, control }) =>
        control ? !clearOf(start, control, end, port.ink, 1.5) : crosses(start, end, port.ink, 1.5),
      )
    )
      throw new RangeError('Leave more room around input label ' + port.name + '.');
  }
}
