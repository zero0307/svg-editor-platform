import type { DocumentView, EditorSessionPort, ShapeView } from '@svgframe/core';

import { indexFlowchart, type Chart } from './flowchart.js';

import { drawEdges } from './drawEdges.js';
import { readFlowchart } from './readFlowchart.js';

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
    return {
      path,
      ...summarize(document),
      graph: readFlowchart(document),
      warnings: [...warnings],
    };
  }
  async createFlowchart(chart: Chart) {
    if (![chart.width, chart.height].every((n) => Number.isFinite(n) && n > 0))
      throw new RangeError('Canvas dimensions must be positive.');
    const nodes = indexFlowchart(chart);
    for (const node of chart.nodes) {
      if (
        ![node.x, node.y, node.width, node.height].every(Number.isFinite) ||
        node.width <= 0 ||
        node.height <= 0
      )
        throw new RangeError('Invalid node geometry: ' + node.id);
    }
    const session = this.newSession();
    session.init(chart.width, chart.height);
    drawEdges(session, chart, nodes);
    for (const n of nodes.values()) {
      session.create({
        type: 'g',
        id: n.id,
        args: [],
        dataAttributes: { 'data-dsh-role': 'node' },
      });
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
          args: [
            String(n.x + Math.min(12, n.width / 8)),
            String(n.y + n.height / 2 + Math.min(5, n.height / 8)),
            n.label,
          ],
        },
        n.id,
      );
    }
    const saved = await session.save(chart.path);
    return { path: saved.path, nodes: chart.nodes.length, edges: chart.edges.length };
  }
}
