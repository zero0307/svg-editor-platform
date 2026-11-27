import type { DocumentView, ShapeView } from '@svgframe/core';
import { fontSize, wrapLabel } from './chartText.js';
import { quadraticPoints } from './session.cjs';
import type { Point } from './edgeRouting.js';
import { validPortName, type GraphEdge, type GraphNode } from './flowchart.js';

function rectOf(group: ShapeView) {
  return group.children.find(
    (s) =>
      (s.kind === 'rect' && s.id === group.id + '-rect') ||
      (s.kind === 'ellipse' && s.id === group.id + '-ellipse'),
  );
}
function atRect(rect: ShapeView, point: Point, center: boolean): boolean {
  if (rect.kind === 'ellipse') {
    const { cx, cy, rx, ry } = rect.attributes;
    if (center) return false;
    return (
      Math.abs(
        ((point.x - Number(cx)) / Number(rx)) ** 2 + ((point.y - Number(cy)) / Number(ry)) ** 2 - 1,
      ) < 1e-6
    );
  }
  const { x, y, width, height } = rect.attributes;
  const { x: px, y: py } = point;
  const left = Number(x),
    top = Number(y),
    w = Number(width),
    h = Number(height);
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  if (center) return near(px, left + w / 2) && near(py, top + h / 2);
  return (
    px >= left - 1e-6 &&
    px <= left + w + 1e-6 &&
    py >= top - 1e-6 &&
    py <= top + h + 1e-6 &&
    (near(px, left) || near(px, left + w) || near(py, top) || near(py, top + h))
  );
}

function linePoint(s: ShapeView, end: 1 | 2) {
  return { x: Number(s.attributes['x' + end]), y: Number(s.attributes['y' + end]) };
}
const nearPoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
function routeSpan(s: ShapeView) {
  if (s.kind === 'line')
    return { start: linePoint(s, 1), end: linePoint(s, 2), control: undefined };
  if (s.kind !== 'path') return undefined;
  const { x1, y1, cx, cy, x2, y2 } = quadraticPoints(s.attributes.d ?? '');
  return { start: { x: x1, y: y1 }, control: { x: cx, y: cy }, end: { x: x2, y: y2 } };
}

// Both wings must meet the actual terminal tangent and lie on opposite sides behind the tip.
function arrowMatches(edge: ShapeView, previous: Point, tip: Point): boolean {
  const wings = edge.children.filter((s) => s.attributes['data-dsh-part'] === 'arrow');
  if (wings.length !== 2) return false;
  const dx = tip.x - previous.x,
    dy = tip.y - previous.y;
  const sides = wings.map((s) => {
    if (s.kind !== 'line' || !nearPoint(linePoint(s, 2), tip)) return 0;
    const start = linePoint(s, 1),
      x = start.x - tip.x,
      y = start.y - tip.y;
    return x * dx + y * dy < 0 ? Math.sign(dx * y - dy * x) : 0;
  });
  return sides[0]! * sides[1]! === -1;
}

// Check the actual fork tree in the SVG. A missing arm must not turn a three-input
// relationship into a verified one-input relationship on read-back.
function readPorts(edge: ShapeView, target: ShapeView, junction: Point): string[] | undefined {
  let expected: unknown;
  try {
    expected = JSON.parse(edge.attributes['data-dsh-inputs'] ?? '');
  } catch {
    return;
  }
  const parts = (key: string) => edge.children.filter((c) => c.attributes['data-dsh-part'] === key);
  const groups = parts('port'),
    bus = parts('bus');
  if (
    target.kind !== 'rect' ||
    !Array.isArray(expected) ||
    !expected.length ||
    groups.length !== expected.length ||
    new Set(expected).size !== expected.length ||
    bus.length !== Number(groups.length > 1) ||
    parts('arrow').length
  )
    return;
  const bases: Point[] = [];
  let vector: Point | undefined;
  for (const [i, g] of groups.entries()) {
    const branches = g.children.filter(
      (c) => c.kind === 'line' && c.attributes['data-dsh-part'] === 'branch',
    );
    const labels = g.children.filter((c) => c.kind === 'text');
    if (
      g.kind !== 'g' ||
      branches.length !== 1 ||
      labels.length !== 1 ||
      labels[0]!.text !== expected[i] ||
      !validPortName(expected[i])
    )
      return;
    if (g.children.length !== 4) return;
    const base = linePoint(branches[0]!, 1),
      tip = linePoint(branches[0]!, 2);
    const delta = { x: tip.x - base.x, y: tip.y - base.y };
    const eps = 1e-6;
    if (
      Math.abs(delta.x) < eps === Math.abs(delta.y) < eps ||
      !atRect(target, tip, false) ||
      !arrowMatches(g, base, tip) ||
      (vector && !nearPoint(delta, vector))
    )
      return;
    const { x, y, width, height } = target.attributes;
    const face =
      delta.x > eps
        ? Number(x)
        : delta.x < -eps
          ? Number(x) + Number(width)
          : delta.y > 0
            ? Number(y)
            : Number(y) + Number(height);
    if (Math.abs((Math.abs(delta.x) > eps ? tip.x : tip.y) - face) > eps) return;
    // The visible text must still sit alongside this arm. Moving Q above K
    // changes how a person reads the diagram, even when the metadata is intact.
    const label = labels[0]!,
      size = Number(label.attributes['font-size']);
    const xText = Number(label.attributes.x),
      yText = Number(label.attributes.y);
    const name = label.text!;
    const horizontal = Math.abs(delta.x) > eps;
    const along = horizontal
      ? (xText + (wrapLabel(name, Infinity)[0]!.width * size) / (2 * fontSize) - base.x) / delta.x
      : (yText - size * 0.35 - base.y) / delta.y;
    const offset = horizontal ? (tip.y - yText) / size : (xText - tip.x) / size;
    if (!(size > 0 && along > 0 && along < 1 && offset > 0 && offset < 1.4)) return;
    const last = bases.at(-1);
    if (
      last &&
      (Math.abs(delta.x) > eps
        ? Math.abs(base.x - last.x) > eps || base.y <= last.y
        : Math.abs(base.y - last.y) > eps || base.x <= last.x)
    )
      return;
    bases.push(base);
    vector = delta;
  }
  const first = bases[0]!,
    last = bases.at(-1)!;
  if (!nearPoint(junction, { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 })) return;
  if (
    bus.length &&
    (bus[0]!.kind !== 'line' ||
      !nearPoint(linePoint(bus[0]!, 1), first) ||
      !nearPoint(linePoint(bus[0]!, 2), last))
  )
    return;
  return expected as string[];
}

export function readFlowchart(doc: DocumentView) {
  const nodes: GraphNode[] = [],
    edges: GraphEdge[] = [],
    unresolvedEdges: string[] = [],
    inferredEdges: string[] = [];
  const bodies = new Map<string, ShapeView>(),
    legacyBodies = new Map<string, ShapeView>();
  const connectors: ShapeView[] = [];
  function scan(s: ShapeView) {
    const role = s.attributes['data-dsh-role'];
    if (s.kind === 'g' && role === 'edge') {
      connectors.push(s);
      return;
    }
    if (s.kind === 'line' || s.kind === 'path') {
      connectors.push(s);
      return;
    }
    const rect = rectOf(s);
    const text = s.children.find((c) => c.kind === 'text' && c.id === s.id + '-label');
    if (s.kind === 'g' && rect && text && (role === 'node' || (!role && s.children.length === 2))) {
      const pieces = [text.text ?? ''];
      for (const child of s.children) {
        if (child.kind !== 'text' || child.attributes['data-dsh-part'] !== 'label-continuation')
          continue;
        const separator = child.attributes['data-dsh-break'];
        pieces.push(
          separator === 'crlf'
            ? '\r\n'
            : separator === 'cr'
              ? '\r'
              : separator === 'lf'
                ? '\n'
                : '',
          child.text ?? '',
        );
      }
      nodes.push({ id: s.id, label: pieces.join('') });
      bodies.set(s.id, rect);
      if (!role) legacyBodies.set(s.id, rect);
      return;
    }
    s.children.forEach(scan);
  }
  doc.children.forEach(scan);
  for (const edge of connectors) {
    if (edge.kind === 'path') {
      unresolvedEdges.push(edge.id);
      continue;
    }
    if (edge.kind === 'line') {
      // Version 0.2 wrote x1,y1 at the source center and x2,y2 at the target center.
      const matches = (end: 1 | 2) =>
        [...legacyBodies].filter(([, rect]) => atRect(rect, linePoint(edge, end), true));
      const start = matches(1),
        finish = matches(2);
      if (start.length === 1 && finish.length === 1 && start[0]![0] !== finish[0]![0]) {
        edges.push({ id: edge.id, from: start[0]![0], to: finish[0]![0] });
        inferredEdges.push(edge.id);
      } else unresolvedEdges.push(edge.id);
      continue;
    }
    const from = edge.attributes['data-dsh-from'],
      to = edge.attributes['data-dsh-to'];
    const route = edge.children
      .filter((s) => s.attributes['data-dsh-part'] === 'route')
      .map(routeSpan);
    const first = route[0],
      last = route.at(-1);
    const source = from && bodies.get(from),
      target = to && bodies.get(to);
    if (
      from &&
      to &&
      from !== to &&
      source &&
      target &&
      first &&
      last &&
      route.every((span, i) => span && (!i || nearPoint(route[i - 1]!.end, span.start))) &&
      atRect(source, first.start, false)
    ) {
      if (edge.attributes['data-dsh-inputs'] !== undefined) {
        const inputs = readPorts(edge, target, last.end);
        if (inputs) edges.push({ id: edge.id, from, to, inputs });
        else unresolvedEdges.push(edge.id);
      } else if (
        atRect(target, last.end, false) &&
        arrowMatches(edge, last.control ?? last.start, last.end)
      ) {
        edges.push({ id: edge.id, from, to });
      } else unresolvedEdges.push(edge.id);
    } else unresolvedEdges.push(edge.id);
  }
  return { nodes, edges, inferredEdges, unresolvedEdges };
}
