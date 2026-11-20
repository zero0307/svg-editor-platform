import { cachedWrap, nodeSize } from './chartText.js';
import { indexFlowchart, type FlowchartGraph } from './flowchart.js';

export function layoutFlowchart(graph: FlowchartGraph) {
  indexFlowchart(graph);
  const vertices = graph.nodes.map((node) => ({
    node,
    incoming: 0,
    successors: [] as number[],
    column: 0,
  }));
  const indices = new Map(vertices.map(({ node }, i) => [node.id, i]));
  const inputCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.inputs) inputCounts.set(edge.to, (inputCounts.get(edge.to) ?? 0) + edge.inputs.length);
    const from = indices.get(edge.from)!;
    const to = indices.get(edge.to)!;
    vertices[from]!.successors.push(to);
    vertices[to]!.incoming++;
  }
  const queue = vertices.filter((v) => v.incoming === 0);
  for (const vertex of queue) {
    for (const index of vertex.successors) {
      const next = vertices[index]!;
      next.column = Math.max(next.column, vertex.column + 1);
      if (--next.incoming === 0) queue.push(next);
    }
  }
  if (queue.length !== vertices.length) {
    const blocked = vertices.filter((v) => v.incoming > 0).map((v) => v.node.id);
    throw new RangeError('Cycle prevents layout of: ' + blocked.join(', '));
  }

  const margin = 28,
    columnGap = 58,
    rowGap = 26;
  const wrap = cachedWrap();
  const sizes = graph.nodes.map((n) => {
    const size = nodeSize(n.label, wrap);
    const count = inputCounts.get(n.id) ?? 0;
    if (count > 1) size.height = Math.max(size.height, 32 + (count - 1) * 24);
    return size;
  });
  const columns: { width: number; height: number; left: number; top: number }[] = [];
  for (const [index, vertex] of vertices.entries()) {
    const layer = (columns[vertex.column] ??= { width: 0, height: 0, left: 0, top: 0 });
    const size = sizes[index]!;
    layer.width = Math.max(layer.width, size.width);
    layer.height += (layer.height ? rowGap : 0) + size.height;
  }
  const height = columns.reduce((max, c) => Math.max(max, c.height), 0) + 2 * margin;
  let left = margin;
  for (const layer of columns) {
    layer.left = left;
    layer.top = (height - layer.height) / 2;
    left += layer.width + columnGap;
  }
  const nodes = vertices.map(({ node, column }, index) => {
    const layer = columns[column]!,
      size = sizes[index]!;
    const positioned = {
      ...node,
      ...size,
      x: layer.left + (layer.width - size.width) / 2,
      y: layer.top,
    };
    layer.top += size.height + rowGap;
    return positioned;
  });
  return {
    width: left - columnGap + margin,
    height,
    nodes,
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}
