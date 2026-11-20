import type { DocumentView, ShapeView } from '@svgframe/core';
import { quadraticPoints } from './session.cjs';
import type { Point } from './edgeRouting.js';
import type { GraphEdge, GraphNode } from './flowchart.js';

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
      atRect(source, first.start, false) &&
      atRect(target, last.end, false) &&
      arrowMatches(edge, last.control ?? last.start, last.end)
    ) {
      edges.push({ id: edge.id, from, to });
    } else unresolvedEdges.push(edge.id);
  }
  return { nodes, edges, inferredEdges, unresolvedEdges };
}
