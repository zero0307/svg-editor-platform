import type { TreeDecorator, TreeRow } from '../../index.js';

/** Consumer example: derive a tree suffix from the public domain `kind`. */
export class DemoTreeDecorator implements TreeDecorator {
  readonly name = 'demo-star';
  decorate(row: TreeRow): string | null {
    return row.node.kind === 'demo-box' ? '(demo)' : null;
  }
}
