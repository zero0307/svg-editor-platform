import { DomainError } from '../domain/DomainError.js';
import { Registry } from './Registry.js';
import type { ShapeProvider } from './ShapeProvider.js';

/** Shape providers keyed by their stable domain type name. */
export class ShapeProviderRegistry extends Registry<ShapeProvider> {
  protected override keyOf(contribution: ShapeProvider): string {
    return contribution.type;
  }
  protected override kind(): string {
    return 'shape provider';
  }
  protected override unknown(key: string): DomainError {
    return new DomainError(`unknown shape type: ${key} (is the plugin loaded?)`);
  }
}
