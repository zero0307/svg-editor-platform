import { DomainError, Numbers, SvgDocument } from '@svgframe/core';
import type { SvgRuntime } from './SvgRuntime.js';

/** One flowchart node supplied by the model. */
export interface FlowchartNode {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
}

/** One directed connector between two node ids. */
export interface FlowchartEdge {
  readonly from: string;
  readonly to: string;
}

/** Validated request of `svg_create_flowchart`. */
export interface FlowchartRequest {
  readonly path: string;
  readonly nodes: readonly FlowchartNode[];
  readonly edges: readonly FlowchartEdge[];
}

/** Summary returned to the model after a successful write. */
export interface FlowchartSummary {
  readonly path: string;
  readonly nodes: number;
  readonly connectors: number;
  readonly elements: number;
}

const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 48;
const CANVAS_MARGIN = 40;
const MIN_CANVAS_WIDTH = 800;
const MIN_CANVAS_HEIGHT = 600;
const NODE_FILL = '#eef2ff';
const NODE_STROKE = '#334155';
const LABEL_FILL = '#0f172a';
const CONNECTOR_STROKE = '#475569';

/**
 * Builds one standalone flowchart document through the public creation service.
 *
 * Every call creates its own `SvgDocument` and only uses provider `create`
 * requests plus public attribute setters, so no state survives the call.
 */
export class FlowchartBuilder {
  constructor(private readonly runtime: SvgRuntime) {}

  build(request: FlowchartRequest): { readonly svg: string; readonly summary: FlowchartSummary } {
    const nodes = FlowchartBuilder.requireNodes(request.nodes);
    const layout = new Map(nodes.map((node) => [node.id, node]));
    const edges = FlowchartBuilder.requireEdges(request.edges, layout);
    let width = MIN_CANVAS_WIDTH;
    let height = MIN_CANVAS_HEIGHT;
    for (const node of nodes) {
      width = Math.max(width, node.x + (node.width ?? DEFAULT_NODE_WIDTH) + CANVAS_MARGIN);
      height = Math.max(height, node.y + (node.height ?? DEFAULT_NODE_HEIGHT) + CANVAS_MARGIN);
    }
    const document = new SvgDocument(width, height);
    for (const node of nodes) {
      const w = node.width ?? DEFAULT_NODE_WIDTH;
      const h = node.height ?? DEFAULT_NODE_HEIGHT;
      const rect = this.runtime.shapes.create({
        id: node.id,
        type: 'rect',
        parameters: [...[node.x, node.y, w, h].map((value) => Numbers.format(value)), NODE_FILL],
      });
      rect.setAttribute('stroke', NODE_STROKE);
      rect.setAttribute('stroke-width', '1');
      document.add(rect);
      const label = this.runtime.shapes.create({
        id: node.id + '-label',
        type: 'text',
        parameters: [Numbers.format(node.x + 10), Numbers.format(node.y + h / 2 + 5), node.label],
      });
      label.setAttribute('fill', LABEL_FILL);
      document.add(label);
    }
    let sequence = 1;
    for (const { from, to } of edges) {
      while (document.find('connector-' + sequence)) sequence++;
      const centers = [from, to].flatMap((node) => [
        node.x + (node.width ?? DEFAULT_NODE_WIDTH) / 2,
        node.y + (node.height ?? DEFAULT_NODE_HEIGHT) / 2,
      ]);
      document.add(
        this.runtime.shapes.create({
          id: 'connector-' + sequence++,
          type: 'line',
          parameters: [...centers.map((value) => Numbers.format(value)), CONNECTOR_STROKE],
        }),
      );
    }
    document.validate();
    return Object.freeze({
      svg: this.runtime.codec.encode(document),
      summary: Object.freeze({
        path: request.path,
        nodes: nodes.length,
        connectors: edges.length,
        elements: document.all().length,
      }),
    });
  }

  private static requireNodes(nodes: readonly FlowchartNode[]): readonly FlowchartNode[] {
    if (!Array.isArray(nodes) || nodes.length === 0)
      throw new DomainError('nodes must be a non-empty array');
    const seen = new Set<string>();
    const result: FlowchartNode[] = [];
    for (const node of nodes) {
      FlowchartBuilder.requireNode(node);
      if (seen.has(node.id)) throw new DomainError(`duplicate node id: ${node.id}`);
      seen.add(node.id);
      result.push(node);
    }
    return result;
  }

  private static requireNode(node: FlowchartNode): void {
    if (typeof node?.id !== 'string' || node.id.trim().length === 0)
      throw new DomainError('node id must be a non-empty string');
    if (typeof node.label !== 'string')
      throw new DomainError(`node ${node.id}: label must be a string`);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y))
      throw new DomainError(`node ${node.id}: x and y must be finite numbers`);
    for (const key of ['width', 'height'] as const) {
      const value = node[key];
      if (value !== undefined && (!Number.isFinite(value) || value <= 0))
        throw new DomainError(`node ${node.id}: ${key} must be a positive number`);
    }
  }

  private static requireEdges(
    edges: readonly FlowchartEdge[],
    nodes: ReadonlyMap<string, FlowchartNode>,
  ): { from: FlowchartNode; to: FlowchartNode }[] {
    if (!Array.isArray(edges)) throw new DomainError('edges must be an array');
    return edges.map((edge) => {
      if (typeof edge?.from !== 'string' || typeof edge?.to !== 'string')
        throw new DomainError('edge from and to must be node ids');
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from) throw new DomainError('unknown edge source: ' + edge.from);
      if (!to) throw new DomainError('unknown edge target: ' + edge.to);
      return { from, to };
    });
  }
}
