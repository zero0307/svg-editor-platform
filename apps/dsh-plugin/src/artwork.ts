import { createHash } from 'node:crypto';
import type { FileStore } from '@svgframe/core';
import { parseSvg } from './chartDocument.js';
import { artworkTargets } from './artworkTargets.js';
import { replaceLeafText } from './renameLine.js';

interface Request {
  path: string;
  operation: 'inspect' | 'rename';
  output?: string;
  nodeId?: string;
  textIndex?: number;
  originalText?: string;
  label?: string;
}

type ArtworkResult =
  | {
      path: string;
      selectableNodes: number;
      nodes: { nodeId: string; title: string; textIndex: number; lines: string[] }[];
    }
  | {
      path: string;
      nodeId: string;
      textIndex: number;
      savedLabel: string;
      otherBytesUnchanged: boolean;
      diskReadBack: { originalUnchanged: boolean; outputSha256: string };
    };
export async function artwork(files: FileStore, req: Request): Promise<ArtworkResult> {
  const before = await files.read(req.path),
    nodes = artworkTargets(parseSvg(before));
  if (req.operation === 'inspect')
    return {
      path: req.path,
      selectableNodes: nodes.length,
      nodes: nodes.map((n) => ({
        nodeId: n.id,
        title: n.title,
        textIndex: n.textIndex,
        lines: n.rows.map((r) => r.value),
      })),
    };
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
  await files.write(output, after);
  const [saved, original] = await Promise.all([files.read(output), files.read(req.path)]);
  if (saved !== after || original !== before)
    throw new Error('Artwork changed during disk verification.');
  return {
    path: output,
    nodeId,
    textIndex: textIndex!,
    savedLabel: label,
    otherBytesUnchanged: true,
    diskReadBack: {
      originalUnchanged: true,
      outputSha256: createHash('sha256').update(saved).digest('hex'),
    },
  };
}
