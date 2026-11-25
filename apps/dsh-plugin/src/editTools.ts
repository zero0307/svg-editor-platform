import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { DshFileStore } from './DshFileStore.js';
import { checkFlowchart } from './checkFlowchart.js';
import { parseSvg, serialize } from './chartDocument.js';
import { editFlowchart } from './editFlowchart.js';

export function registerEditTools(ctx: Context) {
  const str = { type: 'string' } as const,
    required = { ...str, required: true } as const;
  const names = { type: 'array', items: str } as const,
    num = { type: 'number' } as const;
  const output = {
    schema: { type: 'object', additionalProperties: true },
    render: (_args: unknown, v: unknown) => [{ type: 'text' as const, text: JSON.stringify(v) }],
  } as const;
  const store = (exec: ToolRunContext) => new DshFileStore(ctx, exec);
  ctx.tools.register(
    defineTool({
      name: 'svg_edit_flowchart',
      description:
        'For a picked node, use the path and nodeId from its SVG selection. Rename one line with operation=rename, labelLine (1 is the node title) and label. It saves and rereads the file, verifies all other bytes and returns the full saved label. Edit an existing native SVG in place geometrically and save a new file. Use merge_inputs for a shared trunk with labeled arrows: from/to can be node IDs or unique visible labels, inputs e.g. ["K","V"]. Handles existing port boxes automatically. Preserves all unrelated elements and creates a cropped before/after comparison. To insert a step on one edge, use operation "insert" with edgeId, new nodeId and label; coordinates are optional. Use "rename" with nodeId/label and "reconnect" with edgeId and from/to. Returned output is geometry-verified; use svg_check_flowchart to recheck the delivered file after any subsequent edit.',
      parameters: {
        path: required,
        output: required,
        operation: {
          type: 'string',
          required: true,
          enum: ['merge_inputs', 'rename', 'reconnect', 'insert'],
        },
        from: str,
        to: str,
        inputs: names,
        nodeId: str,
        label: str,
        labelLine: {
          ...num,
          description: '1-based line INSIDE nodeId: 1 = node title, 2 = next label line.',
        },
        edgeId: str,
        x: num,
        y: num,
        width: num,
        height: num,
        previewPath: str,
      },
      output: {
        ...output,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: required,
            preview: str,
            previewError: str,
            removedEdges: names,
            addedEdges: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: { id: required, from: required, to: required, inputs: names },
              },
            },
            removedPortNodes: names,
            changedNode: str,
            labelLine: num,
            savedLabel: str,
            diskReadBack: {
              type: 'object',
              additionalProperties: false,
              properties: {
                originalUnchanged: { type: 'boolean', required: true },
                outputSha256: required,
                nodes: { ...num, required: true },
                edges: { ...num, required: true },
                warnings: { ...names, required: true },
              },
            },
            otherBytesUnchanged: { type: 'boolean' },
            unrelatedNodesMoved: num,
            verified: { type: 'boolean' },
          },
        },
      },
      execute: (args, exec) => editFlowchart(store(exec), args),
    }),
  );
  ctx.tools.register(
    defineTool({
      name: 'svg_check_flowchart',
      description:
        'Check the saved SVG against independently specified required node IDs, label counts and directed connections. For a real shared trunk use one connection with inputs ["K","V"]. Reports incomplete arrow ports, missing requirements or unverified geometry.',
      parameters: {
        path: required,
        requiredNodes: names,
        markPath: {
          ...str,
          description:
            'Optional new .svg path for a marked copy when bad arrow tips have known coordinates.',
        },
        labels: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { label: required, minimum: { ...num, required: true } },
          },
        },
        connections: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { from: required, to: required, inputs: names },
          },
        },
      },
      output,
      async execute(args, exec) {
        const files = store(exec),
          raw = await files.read(args.path);
        const check = await checkFlowchart(raw, args);
        if (args.markPath && check.locations?.length) {
          const root = parseSvg(raw);
          for (const p of check.locations) {
            const marker = root.ownerDocument!.createElementNS(root.namespaceURI, 'circle');
            for (const [k, v] of Object.entries({
              cx: String(p.x),
              cy: String(p.y),
              r: '13',
              fill: 'none',
              stroke: '#b31936',
              'stroke-width': '2.5',
            }))
              marker.setAttribute(k, v);
            root.appendChild(marker);
          }
          await files.write(args.markPath, serialize(root));
          return { ...check, marked: args.markPath };
        }
        return { ...check, locations: check.locations ?? [] };
      },
    }),
  );
}
