import type { EditorSessionPort } from '@svgframe/core';
import { arrowWings, makeEdgeRouter, type Point } from './edgeRouting.js';
import { shapeRoute, type ConnectorStyle, type Span } from './curveRoute.js';
import { automaticPorts } from './automaticPorts.js';
import { inputFork, checkPortLabels, type ForkPort } from './inputFork.js';
import type { Bounds } from './edgeRouting.js';
import type { Chart, ChartNode, Tone } from './flowchart.js';

import { addSpanSegments, type Segment } from './connectorCrossings.js';

export function drawEdges(
  session: EditorSessionPort,
  chart: Chart,
  nodes: ReadonlyMap<string, ChartNode>,
  color: string,
  graphicId: (preferred: string) => string,
  captionObstacles?: Span[],
  captionBoxes?: Bounds[],
  preserved: readonly Segment[] = [],
): void {
  const portLabels: ForkPort[] = [];
  const obstacles = captionObstacles ?? (chart.edges.some((e) => e.inputs) ? [] : undefined);
  const routeEdge = makeEdgeRouter(chart);
  const namedRoutes = automaticPorts(chart, nodes);
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
  const plans = chart.edges.map((edge) => {
    const key = pairKey(edge.from, edge.to),
      index = (drawn.get(key) ?? 0) + 1;
    drawn.set(key, index);
    const route =
      namedRoutes.get(edge.id) ??
      routeEdge(nodes.get(edge.from)!, nodes.get(edge.to)!, index / (totals.get(key)! + 1));
    const from = nodes.get(edge.from)!,
      to = nodes.get(edge.to)!;
    const fork = edge.inputs && inputFork(route, edge.inputs, from, to, chart);
    const style = fork
      ? 'angular'
      : (options.get(edge.id)?.style ?? chart.connectorStyle ?? 'angular');
    return { edge, from, to, route: fork?.trunk ?? route, fork, style, spans: [] as Span[] };
  });
  const neighbours = [...preserved];
  const hasArc = plans.some((p) => p.style === 'arc');
  // Resolve fixed connections first, even if they appear last in the SVG.
  // Emit groups in their original order so ids and layering stay predictable.
  const routingOrder = hasArc
    ? [...plans.filter((p) => p.style !== 'arc'), ...plans.filter((p) => p.style === 'arc')]
    : plans;
  for (const plan of routingOrder) {
    plan.spans = shapeRoute(plan.route, plan.style, chart, plan.from, plan.to, neighbours);
    if (!hasArc) continue;
    for (const span of plan.spans) addSpanSegments(span, neighbours);
    if (plan.fork) {
      const ports = plan.fork.ports;
      if (ports.length > 1) neighbours.push({ start: ports[0]!.base, end: ports.at(-1)!.base });
      for (const port of ports) {
        neighbours.push({ start: port.base, end: port.tip });
        for (const wing of arrowWings(port.base, port.tip))
          neighbours.push({ start: wing, end: port.tip });
      }
    } else {
      const tail = plan.spans.at(-1)!;
      for (const wing of arrowWings(tail.control ?? tail.start, tail.end))
        neighbours.push({ start: wing, end: tail.end });
    }
  }
  for (const { edge, fork, spans } of plans) {
    session.create({
      type: 'g',
      id: edge.id,
      args: [],
      dataAttributes: {
        'data-dsh-role': 'edge',
        'data-dsh-from': edge.from,
        'data-dsh-to': edge.to,
        ...(edge.inputs ? { 'data-dsh-inputs': JSON.stringify(edge.inputs) } : {}),
      },
    });
    const rule = options.get(edge.id);
    const muted = rule?.tone === 'muted',
      accent = rule?.tone === 'accent',
      strong = rule?.tone === 'strong';
    const print = chart.theme === 'print';
    const stroke = muted
      ? print
        ? '#656565'
        : chart.theme === 'presentation'
          ? '#68778A'
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
    function line(
      a: Point,
      b: Point,
      part: 'route' | 'arrow' | 'bus' | 'branch',
      parent = edge.id,
    ) {
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
        parent,
      );
    }
    for (const span of spans) {
      obstacles?.push(span);
      const { start, end, control } = span;
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
    function arrow(a: Point, b: Point, parent: string) {
      for (const wing of arrowWings(a, b)) {
        obstacles?.push({ start: wing, end: b });
        line(wing, b, 'arrow', parent);
      }
    }
    if (fork) {
      const ports = fork.ports;
      if (ports.length > 1) {
        const first = ports[0]!.base,
          last = ports.at(-1)!.base;
        line(first, last, 'bus');
        obstacles?.push({ start: first, end: last });
      }
      for (const p of ports) {
        const group = graphicId(edge.id + '-port-' + p.name);
        session.create(
          { type: 'g', id: group, args: [], dataAttributes: { 'data-dsh-part': 'port' } },
          edge.id,
        );
        line(p.base, p.tip, 'branch', group);
        obstacles?.push({ start: p.base, end: p.tip });
        arrow(p.base, p.tip, group);
        session.create(
          {
            type: 'text',
            id: graphicId(group + '-name'),
            args: [String(p.text.x), String(p.text.y), p.name],
            presentation: {
              fill: stroke,
              'font-family': 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
              'font-size': '11',
              'font-weight': '700',
            },
          },
          group,
        );
        captionBoxes?.push(p.ink);
        portLabels.push(p);
      }
    } else {
      const tail = spans.at(-1)!;
      arrow(tail.control ?? tail.start, tail.end, edge.id);
    }
  }
  if (portLabels.length) checkPortLabels(portLabels, obstacles!);
}
