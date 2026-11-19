import type { Context } from '@deepseek-ai/cordis';
import { ToolArgsError, defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { DshFileStore } from './DshFileStore.js';
import { Phase1EditorSession } from './session.cjs';
import { SvgTools } from './SvgTools.js';

export const name = 'svg-editor';
export const inject = ['tools', 'fs', 'workingDirectory', 'sandboxPolicy'];

const number = { type: 'number', required: true } as const;
const string = { type: 'string', required: true } as const;
const path = { ...string, description: 'SVG path in the current session workspace.' } as const;
const summary = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path,
    width: number,
    height: number,
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
    new SvgTools(() => new Phase1EditorSession(new DshFileStore(ctx, exec)));
  ctx.tools.register(
    defineTool({
      name: 'svg_inspect',
      description:
        'Read an SVG supported by the editor. Return canvas size, ordered structure, leaf text, type counts and import warnings.',
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
        'Create a new editable SVG with labeled rectangle nodes and straight connections. Choose a new .svg path. Coordinates are top-left canvas units.',
      parameters: {
        path,
        width: number,
        height: number,
        nodes: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: string,
              label: string,
              x: number,
              y: number,
              width: number,
              height: number,
            },
          },
        },
        edges: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { id: string, from: string, to: string },
          },
        },
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
          if (error instanceof RangeError) throw new ToolArgsError([error.message]);
          throw error;
        }
      },
    }),
  );
}
