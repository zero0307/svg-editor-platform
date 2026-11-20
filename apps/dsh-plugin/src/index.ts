import type { Context } from '@deepseek-ai/cordis';
import { ToolArgsError, defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { DshFileStore } from './DshFileStore.js';
import { Phase1EditorSession } from './session.cjs';
import { layoutFlowchart } from './layoutFlowchart.js';
import { SvgTools } from './SvgTools.js';

export const name = 'svg-editor';
export const inject = ['tools', 'fs', 'workingDirectory', 'sandboxPolicy'];

const number = { type: 'number', required: true } as const;
const string = { type: 'string', required: true } as const;
const path = { ...string, description: 'SVG path in the current session workspace.' } as const;
const nodeFields = { id: string, label: string } as const;
const nodes = {
  type: 'array',
  required: true,
  items: { type: 'object', additionalProperties: false, properties: nodeFields },
} as const;
const tone = { type: 'string', enum: ['normal', 'muted', 'accent', 'strong'] } as const;
const connectorStyle = { type: 'string', enum: ['angular', 'rounded', 'arc'] } as const;
const positionedNodes = {
  ...nodes,
  items: {
    ...nodes.items,
    properties: {
      ...nodeFields,
      tone: { type: 'string', enum: ['normal', 'muted', 'accent', 'strong', 'warm'] },
      shape: { type: 'string', enum: ['box', 'ellipse'] },
      x: number,
      y: number,
      width: number,
      height: number,
    },
  },
} as const;
const edges = {
  type: 'array',
  required: true,
  items: {
    type: 'object',
    additionalProperties: false,
    properties: { id: string, from: string, to: string },
  },
} as const;

function argumentError(error: unknown): never {
  if (error instanceof RangeError) throw new ToolArgsError([error.message]);
  throw error;
}
const idList = { type: 'array', required: true, items: { type: 'string' } } as const;
const summary = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path,
    width: number,
    height: number,
    graph: {
      type: 'object',
      required: true,
      additionalProperties: false,
      properties: { nodes, edges, inferredEdges: idList, unresolvedEdges: idList },
    },
    counts: { type: 'object', additionalProperties: true, required: true },
    structure: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: string,
          type: string,
          parent: { required: true, oneOf: [{ type: 'string' }, { type: 'null' }] },
          text: { required: true, oneOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
    warnings: { type: 'array', required: true, items: { type: 'string' } },
  },
} as const;

export function apply(ctx: Context): void {
  const tools = (exec: ToolRunContext) =>
    new SvgTools(
      () => new Phase1EditorSession(new DshFileStore(ctx, exec), { quadraticPaths: true }),
    );
  ctx.tools.register(
    defineTool({
      name: 'svg_layout_flowchart',
      description:
        'Lay out an acyclic flowchart from node IDs, labels and directed edges. Returns canvas dimensions and positioned nodes. Pass this result plus a new path to svg_create_flowchart to save it.',
      parameters: { nodes, edges },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { width: number, height: number, nodes: positionedNodes, edges },
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute(graph) {
        try {
          return layoutFlowchart(graph);
        } catch (error) {
          argumentError(error);
        }
      },
    }),
  );
  ctx.tools.register(
    defineTool({
      name: 'svg_inspect',
      description:
        'Read an SVG supported by the editor. Return canvas size, ordered structure, leaf text, raw SVG counts, import warnings and graph nodes and directed edges. Use graph.edges for verified links, inferredEdges for legacy geometry and unresolvedEdges for unidentified links.',
      parameters: { path },
      output: {
        schema: summary,
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: ({ path }, exec) => tools(exec).inspect(path),
    }),
  );
  ctx.tools.register(
    defineTool({
      name: 'svg_create_flowchart',
      description:
        'Create a new editable SVG with labeled nodes and routed connectors with arrowheads. Choose a new .svg path. Coordinates are top-left canvas units.',
      parameters: {
        path,
        width: number,
        height: number,
        nodes: positionedNodes,
        title: {
          type: 'string',
          description:
            'Optional single-line title in the top 56 canvas units. Reserve space above the nodes.',
        },
        panels: {
          type: 'array',
          description:
            'Background panels at explicit canvas coordinates. Reserve space near the top for the heading and optional notes. The tool repositions captions around nodes and connectors. If a caption cannot fit, enlarge the panel or leave more space above its nodes and retry.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: string,
              headingAlign: { type: 'string', enum: ['start', 'end'] },
              tone,
              description: { type: 'string' },
              x: number,
              y: number,
              width: number,
              height: number,
            },
          },
        },
        connectorStyle: {
          ...connectorStyle,
          description:
            'Match a supplied reference. Keep direct links straight. Use rounded for side detours and arc sparingly for a distinct relationship. Default angular.',
        },
        edgeStyles: {
          type: 'array',
          description:
            'Override geometry and emphasis for named business edges. List each edge ID in at most one group.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { ids: idList, style: connectorStyle, tone },
          },
        },
        theme: {
          type: 'string',
          enum: ['studio', 'print'],
          description: 'Default studio uses role colors. Choose print for grayscale.',
        },
        edges,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { path, nodes: number, edges: number },
        },
        render: (_args, v) => [{ type: 'text', text: JSON.stringify(v) }],
      },
      async execute(args, exec) {
        try {
          return await tools(exec).createFlowchart(args);
        } catch (error) {
          argumentError(error);
        }
      },
    }),
  );
}
