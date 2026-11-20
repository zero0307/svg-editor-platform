import type { DocumentView, ShapeView } from '@svgframe/core';
import type { GraphEdge, GraphNode } from './flowchart.js';

function rectOf(group: ShapeView) {
  return group.children.find((s) => s.kind === 'rect' && s.id === group.id + '-rect');
}
function atRect(rect: ShapeView, line: ShapeView, end: 1 | 2, center: boolean): boolean {
  const { x, y, width, height } = rect.attributes;
  const px = Number(line.attributes['x' + end]),
    py = Number(line.attributes['y' + end]);
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

function connectedSegments(route: ShapeView[]): boolean {
  return route.slice(1).every((segment, index) => {
    const previous = route[index]!.attributes;
    return (
      Math.abs(Number(segment.attributes.x1) - Number(previous.x2)) < 1e-6 &&
      Math.abs(Number(segment.attributes.y1) - Number(previous.y2)) < 1e-6
    );
  });
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
    if (s.kind === 'line') {
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
    if (edge.kind === 'line') {
      // Version 0.2 wrote x1,y1 at the source center and x2,y2 at the target center.
      const matches = (end: 1 | 2) =>
        [...legacyBodies].filter(([, rect]) => atRect(rect, edge, end, true));
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
    const route = edge.children.filter(
      (s) => s.kind === 'line' && s.attributes['data-dsh-part'] === 'route',
    );
    const source = from && bodies.get(from),
      target = to && bodies.get(to);
    if (
      from &&
      to &&
      from !== to &&
      source &&
      target &&
      route.length &&
      connectedSegments(route) &&
      atRect(source, route[0]!, 1, false) &&
      atRect(target, route.at(-1)!, 2, false)
    ) {
      edges.push({ id: edge.id, from, to });
    } else unresolvedEdges.push(edge.id);
  }
  return { nodes, edges, inferredEdges, unresolvedEdges };
}
