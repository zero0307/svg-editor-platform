import { parseSvg } from '../src/chartDocument.ts';
import { artworkTargets } from '../src/artworkTargets.ts';
import { edgeTargets } from '../src/edgeTargets.ts';
import { reconnectArtwork } from '../src/artworkReconnect.ts';
import { prepareNativeEdit } from '../src/nativeEditCandidate.ts';

// Reuse the host's candidate builders. Nothing here can write to a workspace.
export async function edgePreview(source, edge, changes) {
  let after;
  if (edge.artwork) {
    const root = parseSvg(source);
    const nodes = artworkTargets(root);
    const original = edgeTargets(root, nodes).find((e) => e.id === edge.id && e.artwork);
    if (!original) throw new Error('连线已变化，请重新点选。');
    after = reconnectArtwork(
      source,
      root,
      original,
      nodes,
      changes.from,
      changes.to,
      changes.connectorStyle,
    ).source;
  } else {
    after = (
      await prepareNativeEdit(source, {
        operation: 'reconnect',
        path: 'original.svg',
        output: 'preview.svg',
        edgeId: edge.id,
        ...changes,
      })
    ).after;
  }
  const root = parseSvg(after);
  const updated = edgeTargets(root, artworkTargets(root)).find((e) => e.id === edge.id);
  if (!updated) throw new Error('无法在修改结果中定位这条线。');
  return { blob: new Blob([after], { type: 'image/svg+xml' }), parts: updated.parts };
}
