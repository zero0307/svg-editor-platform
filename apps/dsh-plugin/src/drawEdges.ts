import type { EditorSessionPort } from '@svgframe/core';
import { arrowWings, routeEdge, type Point } from './edgeRouting.js';
import type { Chart, ChartNode } from './flowchart.js';

export function drawEdges(
  session: EditorSessionPort,
  chart: Chart,
  nodes: ReadonlyMap<string, ChartNode>,
): void {
  // Keep raw SVG IDs unique even when user IDs resemble our generated segment IDs.
  const used = new Set(chart.edges.map((edge) => edge.id));
  for (const n of nodes.values())
    for (const id of [n.id, n.id + '-rect', n.id + '-label']) used.add(id);
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
      chart,
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
    function line(a: Point, b: Point, part: 'route' | 'arrow') {
      let id: string;
      do {
        id = 'dsh-line-' + ++serial;
      } while (used.has(id));
      session.create(
        {
          type: 'line',
          id,
          args: [a.x, a.y, b.x, b.y].map(String).concat('black'),
          dataAttributes: { 'data-dsh-part': part },
        },
        edge.id,
      );
    }
    route.slice(1).forEach((point, i) => line(route[i]!, point, 'route'));
    const tip = route.at(-1)!;
    for (const wing of arrowWings(route.at(-2)!, tip)) line(wing, tip, 'arrow');
  }
}
