import type { DocumentView, EditorSessionPort, ShapeView } from '@svgframe/core';

export interface ChartNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Chart {
  path: string;
  width: number;
  height: number;
  nodes: readonly ChartNode[];
  edges: readonly { id: string; from: string; to: string }[];
}

function summarize(doc: DocumentView) {
  const counts = new Map<string, number>();
  const structure: { id: string; type: string; parent: string | null; text: string | null }[] = [];
  const visit = (shape: ShapeView, parent: string | null): void => {
    counts.set(shape.kind, (counts.get(shape.kind) ?? 0) + 1);
    structure.push({ id: shape.id, type: shape.kind, parent, text: shape.text });
    shape.children.forEach((child) => visit(child, shape.id));
  };
  doc.children.forEach((shape) => visit(shape, null));
  return { width: doc.width, height: doc.height, counts: Object.fromEntries(counts), structure };
}

export class SvgTools {
  constructor(private readonly newSession: () => EditorSessionPort) {}
  async inspect(path: string) {
    const { document, warnings } = await this.newSession().read(path);
    return { path, ...summarize(document), warnings: [...warnings] };
  }
  async createFlowchart(chart: Chart) {
    if (![chart.width, chart.height].every((n) => Number.isFinite(n) && n > 0))
      throw new RangeError('Canvas dimensions must be positive.');
    if (!chart.nodes.length) throw new RangeError('Provide at least one flowchart node.');
    const ids = new Set<string>();
    const reserve = (id: string): void => {
      if (!id || /\s/u.test(id) || ids.has(id))
        throw new RangeError('Invalid or duplicate SVG id: ' + id);
      ids.add(id);
    };
    const nodes = new Map<string, ChartNode>();
    for (const node of chart.nodes) {
      if (
        ![node.x, node.y, node.width, node.height].every(Number.isFinite) ||
        node.width <= 0 ||
        node.height <= 0
      )
        throw new RangeError('Invalid node geometry: ' + node.id);
      reserve(node.id);
      reserve(node.id + '-rect');
      reserve(node.id + '-label');
      nodes.set(node.id, node);
    }
    const session = this.newSession();
    session.init(chart.width, chart.height);
    // Edges go behind node bodies in SVG paint order.
    for (const edge of chart.edges) {
      reserve(edge.id);
      const from = nodes.get(edge.from),
        to = nodes.get(edge.to);
      if (!from || !to) throw new RangeError('Unknown endpoint for edge ' + edge.id);
      if (from === to) throw new RangeError('Self-loops require explicit routing: ' + edge.id);
      const args = [
        from.x + from.width / 2,
        from.y + from.height / 2,
        to.x + to.width / 2,
        to.y + to.height / 2,
      ].map(String);
      session.create({ type: 'line', id: edge.id, args: [...args, 'black'] });
    }
    for (const n of nodes.values()) {
      session.create({ type: 'g', id: n.id, args: [] });
      session.create(
        {
          type: 'rect',
          id: n.id + '-rect',
          args: [...[n.x, n.y, n.width, n.height].map(String), '#e8f2ff'],
        },
        n.id,
      );
      session.create(
        {
          type: 'text',
          id: n.id + '-label',
          args: [String(n.x + 4), String(n.y + n.height / 2), n.label],
        },
        n.id,
      );
    }
    const saved = await session.save(chart.path);
    return { path: saved.path, nodes: chart.nodes.length, edges: chart.edges.length };
  }
}
