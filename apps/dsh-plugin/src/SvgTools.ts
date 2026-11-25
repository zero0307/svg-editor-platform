import type { DocumentView, EditorSessionPort, ShapeView } from '@svgframe/core';

import { graphicIds, indexFlowchart, type Chart } from './flowchart.js';

import { drawPanels } from './drawPanels.js';
import { drawEdges } from './drawEdges.js';
import { portEdits } from './portEdits.js';
import { readFlowchart } from './readFlowchart.js';

import { chartPaint } from './chartTheme.js';
import { cachedWrap, fitLabel } from './chartText.js';

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
    const graph = readFlowchart(document);
    const edits = warnings.length || graph.unresolvedEdges.length ? [] : portEdits(graph);
    return {
      path,
      ...(edits.length ? { availableEdits: edits } : {}),
      graph,
      ...summarize(document),
      warnings: [...warnings],
    };
  }
  async inspectNode(path: string, nodeId: string) {
    const { document, warnings } = await this.newSession().read(path);
    const graph = readFlowchart(document);
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new RangeError('No graph node with ID ' + nodeId);
    return {
      path,
      node,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
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
    const paint = chartPaint(chart);
    const graphicId = graphicIds(chart);
    const captions = drawPanels(session, chart, graphicId);
    drawEdges(
      session,
      chart,
      nodes,
      paint.connector,
      graphicId,
      captions?.spans,
      captions?.occupied,
    );
    captions?.render();
    const wrap = cachedWrap();
    for (const n of nodes.values()) {
      const oval = n.shape === 'ellipse';
      const nodePaint = paint.node(n.id, n.tone);
      session.create({
        type: 'g',
        id: n.id,
        args: [],
        dataAttributes: { 'data-dsh-role': 'node' },
      });
      session.create(
        {
          type: oval ? 'ellipse' : 'rect',
          id: n.id + (oval ? '-ellipse' : '-rect'),
          args: [
            ...(oval
              ? [n.x + n.width / 2, n.y + n.height / 2, n.width / 2, n.height / 2]
              : [n.x, n.y, n.width, n.height]
            ).map(String),
            nodePaint.fill,
          ],
          presentation: {
            stroke: nodePaint.stroke,
            'stroke-width': '1.5',
            ...(oval ? {} : { rx: String(Math.min(nodePaint.radius, n.width / 4, n.height / 4)) }),
          },
        },
        n.id,
      );
      if (
        chart.theme === 'presentation' &&
        !oval &&
        n.width >= 72 &&
        n.height >= 32 &&
        (n.tone === 'accent' || n.tone === 'warm')
      ) {
        session.create(
          {
            type: 'rect',
            id: graphicId(n.id + '-accent'),
            args: [String(n.x + 5), String(n.y + 9), '3', String(n.height - 18), nodePaint.stroke],
            presentation: { rx: '1.5' },
            dataAttributes: { 'data-dsh-part': 'accent' },
          },
          n.id,
        );
      }
      const { lines, size, step } = fitLabel(
        n.label,
        n.width,
        n.height,
        wrap,
        chart.theme === 'presentation',
      );
      const firstBaseline = n.y + n.height / 2 - ((lines.length - 1) * step) / 2 + size * 0.34;
      let subtitle = false;
      lines.forEach((line, index) => {
        if (line.before) subtitle = true;
        const secondary = chart.theme === 'presentation' && subtitle;
        const separator =
          line.before === '\r\n'
            ? 'crlf'
            : line.before === '\r'
              ? 'cr'
              : line.before === '\n'
                ? 'lf'
                : 'soft';
        session.create(
          {
            type: 'text',
            id: index === 0 ? n.id + '-label' : graphicId(n.id + '-label-' + (index + 1)),
            args: [String(n.x + n.width / 2), String(firstBaseline + index * step), line.text],
            presentation: {
              fill: nodePaint.ink,
              'font-family': 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
              'font-size': String(Number((secondary ? size * 0.85 : size).toPrecision(5))),
              'font-weight': secondary ? '400' : '600',
              'text-anchor': 'middle',
            },
            dataAttributes:
              index === 0
                ? undefined
                : { 'data-dsh-part': 'label-continuation', 'data-dsh-break': separator },
          },
          n.id,
        );
      });
    }
    const saved = await session.save(chart.path);
    return { path: saved.path, nodes: chart.nodes.length, edges: chart.edges.length };
  }
}
