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
  for (const edge of graph.edges) {
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

  const margin = 24,
    columnGap = 56,
    rowGap = 28,
    nodeHeight = 48;
  const columns: { width: number; count: number; left: number; top: number }[] = [];
  // Group the original order, independent of when edges released a vertex.
  for (const { node, column } of vertices) {
    const layer = (columns[column] ??= { width: 0, count: 0, left: 0, top: 0 });
    layer.width = Math.max(layer.width, 96, 24 + Array.from(node.label).length * 18);
    layer.count++;
  }
  const rows = columns.reduce((max, layer) => Math.max(max, layer.count), 0);
  const height = margin * 2 + rows * nodeHeight + (rows - 1) * rowGap;
  let left = margin;
  for (const layer of columns) {
    layer.left = left;
    layer.top = margin + ((rows - layer.count) * (nodeHeight + rowGap)) / 2;
    left += layer.width + columnGap;
  }
  const nodes = vertices.map(({ node, column }) => {
    const layer = columns[column]!;
    const position = {
      ...node,
      x: layer.left,
      y: layer.top,
      width: layer.width,
      height: nodeHeight,
    };
    layer.top += nodeHeight + rowGap;
    return position;
  });
  return {
    width: left - columnGap + margin,
    height,
    nodes,
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}
