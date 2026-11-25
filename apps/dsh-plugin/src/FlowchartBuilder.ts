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
    const edges = FlowchartBuilder.requireEdges(request.edges, nodes);
    const fontSizeShift = 5;
    const labelOffset = 10;
    const document = new SvgDocument(
      FlowchartBuilder.canvasWidth(nodes),
      FlowchartBuilder.canvasHeight(nodes),
    );

    for (const node of nodes) {
      const width = node.width ?? DEFAULT_NODE_WIDTH;
      const height = node.height ?? DEFAULT_NODE_HEIGHT;
      const rect = this.runtime.shapes.create({
        type: 'rect',
        id: node.id,
        parameters: [
          Numbers.format(node.x),
          Numbers.format(node.y),
          Numbers.format(width),
          Numbers.format(height),
          NODE_FILL,
        ],
      });
      rect.setAttribute('stroke', NODE_STROKE);
      rect.setAttribute('stroke-width', '1');
      document.add(rect);

      const label = this.runtime.shapes.create({
        type: 'text',
        id: `${node.id}-label`,
        parameters: [
          Numbers.format(node.x + labelOffset),
          Numbers.format(node.y + height / 2 + fontSizeShift),
          node.label,
        ],
      });
      label.setAttribute('fill', LABEL_FILL);
      document.add(label);
    }

    edges.forEach((edge, index) => {
      const from = FlowchartBuilder.nodeById(nodes, edge.from);
      const to = FlowchartBuilder.nodeById(nodes, edge.to);
      const line = this.runtime.shapes.create({
        type: 'line',
        id: FlowchartBuilder.connectorId(document, index),
        parameters: [
          Numbers.format(FlowchartBuilder.centerX(from)),
          Numbers.format(FlowchartBuilder.centerY(from)),
          Numbers.format(FlowchartBuilder.centerX(to)),
          Numbers.format(FlowchartBuilder.centerY(to)),
          CONNECTOR_STROKE,
        ],
      });
      document.add(line);
    });

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
    nodes: readonly FlowchartNode[],
  ): readonly FlowchartEdge[] {
    if (!Array.isArray(edges)) throw new DomainError('edges must be an array');
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of edges) {
      if (typeof edge?.from !== 'string' || typeof edge?.to !== 'string')
        throw new DomainError('edge from and to must be node ids');
      if (!ids.has(edge.from)) throw new DomainError(`unknown edge source: ${edge.from}`);
      if (!ids.has(edge.to)) throw new DomainError(`unknown edge target: ${edge.to}`);
    }
    return edges;
  }

  private static nodeById(nodes: readonly FlowchartNode[], id: string): FlowchartNode {
    const node = nodes.find((candidate) => candidate.id === id);
    if (node === undefined) throw new DomainError(`unknown node: ${id}`);
    return node;
  }

  private static centerX(node: FlowchartNode): number {
    return node.x + (node.width ?? DEFAULT_NODE_WIDTH) / 2;
  }

  private static centerY(node: FlowchartNode): number {
    return node.y + (node.height ?? DEFAULT_NODE_HEIGHT) / 2;
  }

  private static canvasWidth(nodes: readonly FlowchartNode[]): number {
    const right = Math.max(...nodes.map((node) => node.x + (node.width ?? DEFAULT_NODE_WIDTH)));
    return Math.max(MIN_CANVAS_WIDTH, right + CANVAS_MARGIN);
  }

  private static canvasHeight(nodes: readonly FlowchartNode[]): number {
    const bottom = Math.max(...nodes.map((node) => node.y + (node.height ?? DEFAULT_NODE_HEIGHT)));
    return Math.max(MIN_CANVAS_HEIGHT, bottom + CANVAS_MARGIN);
  }

  private static connectorId(document: SvgDocument, index: number): string {
    let suffix = index + 1;
    while (document.find(`connector-${suffix}`) !== undefined) suffix++;
    return `connector-${suffix}`;
  }
}
