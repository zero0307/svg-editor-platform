import type { ChartTheme } from './chartTheme.js';

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

export interface ChartNode extends GraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowchartGraph<T extends GraphNode = GraphNode> {
  nodes: readonly T[];
  edges: readonly GraphEdge[];
}

export interface Chart extends FlowchartGraph<ChartNode> {
  theme?: ChartTheme;
  title?: string;
  panels?: readonly {
    label: string;
    description?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  path: string;
  width: number;
  height: number;
}

// The projected IDs are also real SVG IDs, shared by nodes and edges.
export function indexFlowchart<T extends GraphNode>(graph: FlowchartGraph<T>): Map<string, T> {
  if (!graph.nodes.length) throw new RangeError('Provide at least one flowchart node.');
  const ids = new Set<string>();
  const illegalXml = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\uD800-\uDFFF\uFFFE\uFFFF]/u;
  function reserve(id: string): void {
    if (!id || /\s/u.test(id) || illegalXml.test(id) || ids.has(id))
      throw new RangeError('Invalid or duplicate SVG id: ' + id);
    ids.add(id);
  }
  const nodes = new Map<string, T>();
  for (const node of graph.nodes) {
    reserve(node.id);
    reserve(node.id + '-rect');
    reserve(node.id + '-label');
    if (illegalXml.test(node.label)) throw new RangeError('Invalid XML text in node ' + node.id);
    nodes.set(node.id, node);
  }
  for (const edge of graph.edges) {
    reserve(edge.id);
    for (const id of [edge.from, edge.to]) {
      if (!nodes.has(id)) throw new RangeError('Unknown endpoint ' + id + ' for edge ' + edge.id);
    }
    if (edge.from === edge.to)
      throw new RangeError('Self-loop at node ' + edge.from + ' on edge ' + edge.id);
  }
  return nodes;
}

// Additional graphical pieces must not collide with user IDs or the stable rect/label IDs.
export function graphicIds(chart: Chart) {
  const taken = new Set(chart.edges.map((e) => e.id));
  for (const { id } of chart.nodes)
    for (const value of [id, id + '-rect', id + '-label']) taken.add(value);
  return (preferred: string) => {
    let id = preferred,
      index = 1;
    while (taken.has(id)) id = preferred + '-' + index++;
    taken.add(id);
    return id;
  };
}
