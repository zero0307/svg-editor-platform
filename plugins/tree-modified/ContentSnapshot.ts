import type { ReadonlyDocument, ReadonlyShape } from '@svgframe/core';

/**
 * Persisted-content projection of one document, used for dirty comparison.
 *
 * Only public domain data participates: each node's id, element tag, domain kind,
 * text, parent id, ordered child ids and its persisted attributes (imported
 * metadata such as `data-kind`, geometry and presentation). Nothing here is
 * produced from XML serialization, so indentation, attribute output order or a
 * re-encode cannot create a false dirty state, while the same content rebuilt as a
 * new object graph produces the same fingerprints.
 */
export interface ContentSnapshot {
  /** Own fingerprint per node, keyed by id (the canvas root itself is not a row). */
  readonly own: ReadonlyMap<string, string>;
  /** Parent id per node, used to mark the old ancestor chain when a node is deleted. */
  readonly parents: ReadonlyMap<string, string | null>;
  /** Canvas size, because resizing is persisted content but not a node attribute. */
  readonly canvas: string;
}

/** Build the content projection for the whole document below the canvas root. */
export function contentSnapshot(document: ReadonlyDocument): ContentSnapshot {
  const own = new Map<string, string>();
  const parents = new Map<string, string | null>();
  const visit = (shape: ReadonlyShape, parentId: string | null): void => {
    own.set(shape.id, fingerprint(shape, parentId));
    parents.set(shape.id, parentId);
    shape.children().forEach((child) => visit(child, shape.id));
  };
  document.root.children().forEach((child) => visit(child, document.root.id));
  return { own, parents, canvas: `${document.width}x${document.height}` };
}

/**
 * Ids that must render with `*`: nodes whose persisted projection differs from the
 * baseline, every current ancestor of such a node, every ancestor of a deleted node
 * taken from the **baseline** parent chain, and the root when the canvas size
 * differs. A deleted node itself has no row; only its old ancestors are marked.
 */
export function dirtyIds(
  document: ReadonlyDocument,
  baseline: ContentSnapshot,
): ReadonlySet<string> {
  const current = contentSnapshot(document);
  const dirty = new Set<string>();
  for (const [id, own] of current.own) if (baseline.own.get(id) !== own) dirty.add(id);
  for (const id of baseline.own.keys()) {
    if (current.own.has(id)) continue;
    let parent = baseline.parents.get(id) ?? null;
    while (parent !== null) {
      dirty.add(parent);
      parent = baseline.parents.get(parent) ?? null;
    }
  }
  for (const id of [...dirty]) {
    let parent = current.parents.get(id) ?? null;
    while (parent !== null) {
      dirty.add(parent);
      parent = current.parents.get(parent) ?? null;
    }
  }
  if (current.canvas !== baseline.canvas) dirty.add(document.root.id);
  return dirty;
}

/** One node's persisted projection; attribute names are sorted so order never matters. */
function fingerprint(shape: ReadonlyShape, parentId: string | null): string {
  const attributes = Object.entries(shape.attributes()).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  return JSON.stringify([
    shape.id,
    shape.tag,
    shape.kind,
    shape.textContent(),
    parentId,
    shape.children().map((child) => child.id),
    attributes,
  ]);
}
