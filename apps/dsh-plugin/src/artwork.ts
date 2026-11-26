import { createHash } from 'node:crypto';
import type { FileStore } from '@svgframe/core';
import { parseSvg } from './chartDocument.js';
import { edgeTargets, revisionEdgeTargets } from './edgeTargets.js';
import type { EditConnectorStyle } from './curveRoute.js';
import { reconnectArtwork } from './artworkReconnect.js';
import { artworkTargets } from './artworkTargets.js';
import { replaceLeafText } from './renameLine.js';

interface Request {
  path: string;
  operation: 'inspect' | 'rename' | 'reconnect';
  edgeId?: string;
  originalGeometry?: string;
  connectorStyle?: EditConnectorStyle;
  from?: string;
  to?: string;
  output?: string;
  nodeId?: string;
  textIndex?: number;
  originalText?: string;
  label?: string;
}

async function saveChecked(
  files: FileStore,
  path: string,
  output: string,
  before: string,
  after: string,
) {
  await files.write(output, after);
  const [saved, original] = await Promise.all([files.read(output), files.read(path)]);
  if (saved !== after || original !== before)
    throw new Error('Artwork changed during disk verification.');
  return {
    otherBytesUnchanged: true,
    diskReadBack: {
      originalUnchanged: true,
      outputSha256: createHash('sha256').update(saved).digest('hex'),
    },
  };
}
type Saved = Awaited<ReturnType<typeof saveChecked>> & { path: string };
type ArtworkResult =
  | {
      path: string;
      selectableNodes: number;
      selectableEdges: number;
      nodes: { nodeId: string; title: string; textIndex: number; lines: string[] }[];
      edges: {
        edgeId: string;
        title: string;
        originalGeometry: string;
        reconnectable: boolean;
        from: string | null;
        to: string | null;
      }[];
    }
  | (Saved & { nodeId: string; textIndex: number; savedLabel: string })
  | (Saved & { edgeId: string; from: string; to: string });
export async function artwork(files: FileStore, req: Request): Promise<ArtworkResult> {
  if (req.connectorStyle && req.operation !== 'reconnect')
    throw new RangeError('connectorStyle is only valid for reconnect.');
  const before = await files.read(req.path),
    root = parseSvg(before),
    nodes = artworkTargets(root);
  if (req.operation === 'inspect') {
    const edges = (await revisionEdgeTargets(root, nodes, before)).filter((e) => e.artwork);
    return {
      path: req.path,
      selectableNodes: nodes.length,
      selectableEdges: edges.length,
      nodes: nodes.map((n) => ({
        nodeId: n.id,
        title: n.title,
        textIndex: n.textIndex,
        lines: n.rows.map((r) => r.value),
      })),
      edges: edges.map((e) => {
        const { from, to } = e;
        return {
          edgeId: e.id,
          title: e.title,
          originalGeometry: e.originalGeometry!,
          reconnectable: !!e.reconnectable,
          from: from ?? null,
          to: to ?? null,
        };
      }),
    };
  }
  if (req.operation === 'reconnect') {
    if (!req.output || req.output === req.path) throw new RangeError('Choose a new output path.');
    const edges = await revisionEdgeTargets(root, nodes, before);
    const edge = edges.find((e) => e.artwork && e.id === req.edgeId);
    if (!edge || !req.originalGeometry || edge.originalGeometry !== req.originalGeometry)
      throw new RangeError('The selected connector no longer matches. Inspect and pick it again.');
    const changed = reconnectArtwork(
      before,
      root,
      edge,
      nodes,
      edges,
      req.from,
      req.to,
      req.connectorStyle,
    );
    const savedEdge = edgeTargets(parseSvg(changed.source), nodes).find((e) => e.id === edge.id);
    if (
      !savedEdge ||
      !Object.entries(changed.values).every(([k, v]) => savedEdge.element.getAttribute(k) === v)
    )
      throw new RangeError('The selected route did not round-trip.');
    return {
      path: req.output,
      edgeId: edge.id,
      from: changed.from,
      to: changed.to,
      ...(await saveChecked(files, req.path, req.output, before, changed.source)),
    };
  }
  const { output, nodeId, textIndex, originalText, label } = req;
  if (
    !output ||
    output === req.path ||
    !nodeId ||
    !Number.isInteger(textIndex) ||
    !originalText ||
    label === undefined ||
    !label.trim() ||
    /[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\uD800-\uDFFF\uFFFE\uFFFF]/u.test(label)
  )
    throw new RangeError(
      'Rename requires a new output path, selected node ID, 1-based textIndex, exact originalText and a single nonempty text label.',
    );
  const target = nodes.find((n) => n.id === nodeId),
    row = target?.rows[textIndex! - 1];
  if (!row || row.value !== originalText)
    throw new RangeError(
      'The selected text no longer matches. Inspect this artwork and choose the current text.',
    );
  const text = row.element.textContent!;
  const replacement =
    text.slice(0, text.length - text.trimStart().length) +
    label +
    text.slice(text.trimEnd().length);
  const after = replaceLeafText(before, row.element, replacement);
  const reread = artworkTargets(parseSvg(after)).find((n) => n.id === nodeId);
  if (reread?.rows[textIndex! - 1]?.value !== label.trim())
    throw new RangeError('The replacement did not round-trip in the original SVG.');
  return {
    path: output,
    nodeId,
    textIndex: textIndex!,
    savedLabel: label,
    ...(await saveChecked(files, req.path, output, before, after)),
  };
}
