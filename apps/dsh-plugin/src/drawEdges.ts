import type { EditorSessionPort } from '@svgframe/core';
import { arrowWings, makeEdgeRouter, type Point } from './edgeRouting.js';
import { shapeRoute, type ConnectorStyle } from './curveRoute.js';
import type { Chart, ChartNode, Tone } from './flowchart.js';

export function drawEdges(
  session: EditorSessionPort,
  chart: Chart,
  nodes: ReadonlyMap<string, ChartNode>,
  color: string,
  graphicId: (preferred: string) => string,
): void {
  const routeEdge = makeEdgeRouter(chart);
  const edgeIds = new Set(chart.edges.map((e) => e.id));
  const options = new Map<string, { style?: ConnectorStyle; tone?: Tone }>();
  const styles = ['angular', 'arc', 'rounded'];
  if (!styles.includes(chart.connectorStyle ?? 'angular'))
    throw new RangeError('Unknown connector style.');
  for (const rule of chart.edgeStyles ?? []) {
    if (
      (rule.style && !styles.includes(rule.style)) ||
      (rule.tone && !['normal', 'accent', 'muted', 'strong'].includes(rule.tone))
    )
      throw new RangeError('Unknown edge style or tone.');
    for (const id of rule.ids) {
      if (!edgeIds.has(id) || options.has(id))
        throw new RangeError('Unknown or duplicate styled edge: ' + id);
      options.set(id, rule);
    }
  }
  let serial = 0;
  // Give parallel and antiparallel connectors separate ports on both rectangles.
  const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
  const totals = new Map<string, number>(),
    drawn = new Map<string, number>();
  for (const edge of chart.edges) {
    const key = pairKey(edge.from, edge.to);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  for (const edge of chart.edges) {
    const key = pairKey(edge.from, edge.to),
      index = (drawn.get(key) ?? 0) + 1;
    drawn.set(key, index);
    const route = routeEdge(
      nodes.get(edge.from)!,
      nodes.get(edge.to)!,
      index / (totals.get(key)! + 1),
    );
    session.create({
      type: 'g',
      id: edge.id,
      args: [],
      dataAttributes: {
        'data-dsh-role': 'edge',
        'data-dsh-from': edge.from,
        'data-dsh-to': edge.to,
      },
    });
    const rule = options.get(edge.id);
    const style = rule?.style ?? chart.connectorStyle ?? 'angular';
    const muted = rule?.tone === 'muted',
      accent = rule?.tone === 'accent',
      strong = rule?.tone === 'strong';
    const print = chart.theme === 'print';
    const stroke = muted
      ? print
        ? '#656565'
        : '#9A6335'
      : accent
        ? print
          ? '#202020'
          : '#08766F'
        : strong
          ? print
            ? '#191919'
            : '#193B50'
          : color;
    const width = muted ? '1.4' : accent || strong ? '2.6' : '1.65';
    const dash = muted ? { 'stroke-dasharray': '5 4' } : {};
    function line(a: Point, b: Point, part: 'route' | 'arrow') {
      session.create(
        {
          type: 'line',
          id: graphicId('dsh-line-' + ++serial),
          presentation: {
            'stroke-width': width,
            'stroke-linecap': 'round',
            ...(part === 'route' ? dash : {}),
          },
          args: [a.x, a.y, b.x, b.y].map(String).concat(stroke),
          dataAttributes: { 'data-dsh-part': part },
        },
        edge.id,
      );
    }
    const spans = shapeRoute(route, style, chart, nodes.get(edge.from)!, nodes.get(edge.to)!);
    for (const { start, end, control } of spans) {
      if (!control) {
        line(start, end, 'route');
        continue;
      }
      const d = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
      session.create(
        {
          type: 'path',
          id: graphicId('dsh-curve-' + ++serial),
          args: [d, stroke],
          presentation: { fill: 'none', 'stroke-width': width, 'stroke-linecap': 'round', ...dash },
          dataAttributes: { 'data-dsh-part': 'route' },
        },
        edge.id,
      );
    }
    const tail = spans.at(-1)!;
    for (const wing of arrowWings(tail.control ?? tail.start, tail.end))
      line(wing, tail.end, 'arrow');
  }
}
