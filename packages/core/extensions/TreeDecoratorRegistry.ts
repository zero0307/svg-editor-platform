import { Registry } from './Registry.js';
import type { TreeDecorator } from './TreeDecorator.js';

/** Tree decorators keyed by their stable label name; order is suffix order. */
export class TreeDecoratorRegistry extends Registry<TreeDecorator> {
  protected override keyOf(contribution: TreeDecorator): string {
    return contribution.name;
  }
  protected override kind(): string {
    return 'tree decorator';
  }
}
