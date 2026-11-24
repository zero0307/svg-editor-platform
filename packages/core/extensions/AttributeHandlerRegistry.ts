import { Registry } from './Registry.js';
import type { AttributeHandler } from './AttributeHandler.js';

/** Attribute handlers keyed by their stable handler name. */
export class AttributeHandlerRegistry extends Registry<AttributeHandler> {
  protected override keyOf(contribution: AttributeHandler): string {
    return contribution.name;
  }
  protected override kind(): string {
    return 'attribute handler';
  }
}
