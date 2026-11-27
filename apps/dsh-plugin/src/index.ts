import { registerEditTools } from './editTools.js';
import type { Context } from '@deepseek-ai/cordis';
import { ToolArgsError, defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { DshFileStore } from './DshFileStore.js';
import { Phase1EditorSession } from './session.cjs';
import { prepareChart } from './presentationLayout.js';
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
const measure = { type: 'number' } as const;
const inputNodes = {
  ...positionedNodes,
  items: {
    ...positionedNodes.items,
    properties: {
      ...positionedNodes.items.properties,
      x: measure,
      y: measure,
      width: measure,
      height: measure,
    },
  },
} as const;
const edges = {
  type: 'array',
  required: true,
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: string,
      from: string,
      to: string,
      inputs: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional ordered input port names on a box target (1-8 letters, digits, _ or - per name). One source can branch to multiple named arrows, e.g. ["Q","K","V"]. Use separate edges for different sources.',
      },
    },
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
    availableEdits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { tool: string, operation: string, from: string, to: string, inputs: idList },
      },
    },
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
  registerEditTools(ctx);
  const tools = (exec: ToolRunContext) =>
    new SvgTools(
      () => new Phase1EditorSession(new DshFileStore(ctx, exec), { quadraticPaths: true }),
    );
  ctx.tools.register(
    defineTool({
      name: 'svg_layout_flowchart',
      description:
        'Return coordinates for an acyclic flowchart. To publish an automatically arranged slide in one call, use svg_create_flowchart directly. Returns canvas dimensions and positioned nodes. To save, pass exactly {path, width, height, nodes, edges} from this result to svg_create_flowchart. Omit direction and format when reusing coordinates.',
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
        'Inspect an SVG on disk. Supply nodeId to read just one node and diagram counts. A desktop SVG selection already supplies the ID and current label for direct edits. Without nodeId this returns the full inventory. If the requested shared trunk matches an availableEdits entry, call its tool with those node IDs, port names, the source path and a new output path. The edit preserves unrelated geometry, saves a comparison and verifies the file. Return canvas size, ordered structure, leaf text, raw SVG counts, import warnings and graph nodes and directed edges. Use graph.edges for verified links, inferredEdges for legacy geometry and unresolvedEdges for unidentified links.',
      parameters: { path, nodeId: { type: 'string', description: 'Read one node by stable ID.' } },
      output: {
        schema: {
          oneOf: [
            summary,
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                path,
                node: {
                  type: 'object',
                  required: true,
                  additionalProperties: false,
                  properties: nodeFields,
                },
                nodeCount: number,
                edgeCount: number,
                warnings: { type: 'array', required: true, items: { type: 'string' } },
              },
            },
          ],
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute({ path, nodeId }, exec) {
        try {
          const svg = tools(exec);
          return nodeId === undefined
            ? await svg.inspect(path)
            : await svg.inspectNode(path, nodeId);
        } catch (error) {
          argumentError(error);
        }
      },
    }),
  );
  ctx.tools.register(
    defineTool({
      name: 'svg_create_flowchart',
      description:
        'For a structured flowchart, create a slide-ready editable SVG directly from node IDs/labels and directed edges. For automatic layout omit all coordinates and canvas dimensions. Use direction down for vertical flow, right for horizontal. Use format slide for 16:9 projection. Style using the chart subtitle, node tones, named inputs and edgeStyles. Keep nodes for actual steps so graph counts match. Put secondary text after a newline in a node label. For custom illustrated or reference-matched artwork use svg_artwork to keep the original visual design and enable picking. For explicit coordinates (including svg_layout_flowchart output), supply width, height and positioned nodes. Omit direction and format.',
      parameters: {
        path,
        width: measure,
        height: measure,
        direction: {
          type: 'string',
          enum: ['right', 'down'],
          description: 'Automatic layout only. Omit when passing coordinates.',
        },
        format: {
          type: 'string',
          enum: ['slide', 'content'],
          description:
            'Automatic layout only. Choose slide for exact 16:9 or content for tight bounds. Short titled presentation diagrams default to slides.',
        },
        nodes: inputNodes,
        title: {
          type: 'string',
          description:
            'Optional single-line title in the top 56 canvas units. Reserve space above the nodes.',
        },
        subtitle: {
          type: 'string',
          description: 'Optional short explanation under the chart title. Reserve space for both.',
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
            'Match a supplied reference. Keep direct links straight. Use rounded for side detours and arc sparingly for a distinct relationship. Automatic diagrams default to rounded, explicit diagrams to angular.',
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
          enum: ['studio', 'print', 'presentation'],
          description:
            'Choose presentation for slide-ready diagrams with distinct primary and secondary text, studio for classic role colors, or print for grayscale.',
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
          return await tools(exec).createFlowchart(prepareChart(args));
        } catch (error) {
          argumentError(error);
        }
      },
    }),
  );
}
