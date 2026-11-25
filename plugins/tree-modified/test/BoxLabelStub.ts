import type { TreeDecorator, TreeRow } from '@svgframe/core';

/** Stand-in for the box plugin's label, used only to verify suffix order. */
export class BoxLabelStub implements TreeDecorator {
  readonly name = 'box-type-label';
  decorate(row: TreeRow): string | null {
    return row.node.kind === 'box' ? '(box)' : null;
  }
}
