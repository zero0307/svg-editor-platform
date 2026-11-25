import { DomainError } from '@svgframe/core';
import { FlowchartBuilder } from './FlowchartBuilder.js';
import type {
  DshJsonSchema,
  DshParameterSpec,
  DshTextContent,
  DshToolDefinition,
} from './DshContracts.js';
import type { SvgFileGateway } from './SvgFileGateway.js';
import { SvgInspector } from './SvgInspector.js';
import { SvgRuntime } from './SvgRuntime.js';

const NODE_SPEC: DshParameterSpec = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      required: true,
      description: 'Unique node id, used as the SVG element id.',
    },
    label: { type: 'string', required: true, description: 'Text drawn inside the node.' },
    x: { type: 'number', required: true, description: 'Left edge in user units.' },
    y: { type: 'number', required: true, description: 'Top edge in user units.' },
    width: { type: 'number', description: 'Node width; defaults to 120.' },
    height: { type: 'number', description: 'Node height; defaults to 48.' },
  },
};

const EDGE_SPEC: DshParameterSpec = {
  type: 'object',
  additionalProperties: false,
  properties: {
    from: { type: 'string', required: true, description: 'Source node id.' },
    to: { type: 'string', required: true, description: 'Target node id.' },
  },
};

const INSPECT_OUTPUT: DshJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'width', 'height', 'elements', 'kinds', 'rootChildren'],
  properties: {
    path: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    elements: { type: 'integer' },
    kinds: {
      type: 'object',
      additionalProperties: true,
      description: 'Element count per kind, in stable provider order.',
    },
    rootChildren: { type: 'array', items: { type: 'string' } },
  },
};

const FLOWCHART_OUTPUT: DshJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'nodes', 'connectors', 'elements'],
  properties: {
    path: { type: 'string' },
    nodes: { type: 'integer' },
    connectors: { type: 'integer' },
    elements: { type: 'integer' },
  },
};

const requirePath = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new DomainError('path must be a non-empty string');
  return value;
};

const describeInspection = (value: unknown): DshTextContent[] => {
  const inspection = value as Awaited<ReturnType<SvgInspector['inspect']>>;
  const kinds = Object.entries(inspection.kinds)
    .map(([kind, count]) => `${kind}=${count}`)
    .join(', ');
  const children = inspection.rootChildren.length ? inspection.rootChildren.join(', ') : '(none)';
  return [
    {
      type: 'text',
      text:
        `${inspection.path}: canvas ${inspection.width}x${inspection.height}, ` +
        `${inspection.elements} elements; kinds: ${kinds || '(none)'}; ` +
        `root children: ${children}`,
    },
  ];
};

const describeFlowchart = (value: unknown): DshTextContent[] => {
  const summary = value as { path: string; nodes: number; connectors: number; elements: number };
  return [
    {
      type: 'text',
      text:
        `created ${summary.path}: ${summary.nodes} nodes, ` +
        `${summary.connectors} connectors, ${summary.elements} elements`,
    },
  ];
};

/**
 * Builds the two model-facing tools.
 *
 * Both build a fresh public runtime per call, reach files only through the
 * injected gateway, and never share a document between invocations.
 */
export function createToolDefinitions(gateway: SvgFileGateway): readonly DshToolDefinition[] {
  const inspect: DshToolDefinition = {
    name: 'svg_inspect',
    description:
      'Inspect an SVG file read-only: canvas size, element count, count per element kind and root child ids.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'SVG file path resolved by the host filesystem service.',
      },
    },
    output: { schema: INSPECT_OUTPUT, render: (_args, value) => describeInspection(value) },
    async execute(args, exec) {
      const path = requirePath(args['path']);
      const inspector = new SvgInspector(SvgRuntime.create());
      return inspector.inspect(path, gateway, exec?.signal);
    },
  };

  const flowchart: DshToolDefinition = {
    name: 'svg_create_flowchart',
    description:
      'Create a flowchart SVG from nodes and directed edges and save it to path, then report the summary.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Destination SVG path resolved by the host filesystem service.',
      },
      nodes: {
        type: 'array',
        required: true,
        description: 'Flowchart nodes; ids must be unique.',
        items: NODE_SPEC,
      },
      edges: {
        type: 'array',
        required: true,
        description: 'Directed edges between node ids; drawn center to center.',
        items: EDGE_SPEC,
      },
    },
    output: { schema: FLOWCHART_OUTPUT, render: (_args, value) => describeFlowchart(value) },
    async execute(args, exec) {
      const path = requirePath(args['path']);
      const request = {
        path,
        nodes: (args['nodes'] ?? []) as never,
        edges: (args['edges'] ?? []) as never,
      };
      const builder = new FlowchartBuilder(SvgRuntime.create());
      const { svg, summary } = builder.build(request);
      exec?.signal?.throwIfAborted();
      const target = await gateway.resolve(path, { signal: exec?.signal });
      await gateway.writeText(target, svg, exec?.signal);
      return summary;
    },
  };

  return Object.freeze([inspect, flowchart]);
}
