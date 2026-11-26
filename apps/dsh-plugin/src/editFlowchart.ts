import { createHash } from 'node:crypto';
import type { FileStore } from '@svgframe/core';
import type { EditConnectorStyle } from './curveRoute.js';
import { prepareNativeEdit } from './nativeEditCandidate.js';
import { changePreview } from './changePreview.js';

export interface EditRequest {
  path: string;
  output: string;
  operation: 'merge_inputs' | 'rename' | 'reconnect' | 'insert';
  from?: string;
  to?: string;
  inputs?: string[];
  nodeId?: string;
  label?: string;
  labelLine?: number;
  edgeId?: string;
  connectorStyle?: EditConnectorStyle;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  previewPath?: string;
}

export async function editFlowchart(files: FileStore, req: EditRequest) {
  if (
    req.path === req.output ||
    (req.previewPath && [req.path, req.output].includes(req.previewPath))
  )
    throw new RangeError('Choose distinct .svg paths for the original, output and preview.');
  if (req.connectorStyle && req.operation !== 'reconnect')
    throw new RangeError('connectorStyle is only valid for reconnect.');
  if (req.labelLine !== undefined && req.operation !== 'rename')
    throw new RangeError('labelLine is only valid for rename.');
  const before = await files.read(req.path);
  const { after, context, removed, added, lineEdit, graph, warnings, details } =
    await prepareNativeEdit(before, req);
  await files.write(req.output, after);
  const delivered = await files.read(req.output);
  if (delivered !== after) throw new Error('Saved SVG differs from the verified candidate.');
  const diskReadBack = lineEdit
    ? {
        originalUnchanged: (await files.read(req.path)) === before,
        outputSha256: createHash('sha256').update(delivered).digest('hex'),
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        warnings: [...warnings],
      }
    : undefined;
  const previewPath = req.previewPath ?? req.output.replace(/\.svg$/i, '-对照.svg');
  let preview: string | undefined, previewError: string | undefined;
  try {
    if (!lineEdit || req.previewPath) {
      await files.write(previewPath, changePreview(before, after, context, removed, added));
      preview = previewPath;
    }
  } catch (error) {
    previewError = String(error);
  }
  return {
    path: req.output,
    ...(preview ? { preview } : {}),
    ...(previewError ? { previewError } : {}),
    ...details,
    ...(lineEdit
      ? {
          labelLine: req.labelLine,
          savedLabel: lineEdit.label,
          otherBytesUnchanged: true,
          diskReadBack,
        }
      : {}),
    verified: true,
  };
}
