import type { TreeDecorator, TreeRow } from '@svgframe/core';

/**
 * `(box)` type label for tree rows.
 *
 * The row context is read-only, no other plugin state is consulted and an empty
 * string is never returned, so disabling the plugin restores the Phase 1 tree bytes
 * exactly. The framework adds the separating space for each non-empty suffix and
 * keeps registration order, so this label composes with `modified-star`.
 */
export class BoxTypeLabelDecorator implements TreeDecorator {
  readonly name = 'box-type-label';

  decorate(row: TreeRow): string | null {
    return row.node.kind === 'box' ? '(box)' : null;
  }
}
