import type { AttributeHandlerRegistry } from './AttributeHandlerRegistry.js';
import type { CommandRegistry } from './CommandRegistry.js';
import type { ShapeProviderRegistry } from './ShapeProviderRegistry.js';
import type { TreeDecoratorRegistry } from './TreeDecoratorRegistry.js';
import type { DirectoryReader } from '../ports/DirectoryReader.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';

/**
 * Capabilities available to `activate`: validated read-only options, the public
 * shape/directory service ports and the four registration tables.
 *
 * The host passes staged registries here; nothing in this context exposes the
 * live document, the filesystem, history or arbitrary event subscription.
 */
export interface PluginContext {
  readonly options: Readonly<Record<string, unknown>>;
  readonly shapes: ShapeCreationService;
  readonly directories: DirectoryReader;
  readonly shapeProviders: ShapeProviderRegistry;
  readonly commands: CommandRegistry;
  readonly treeDecorators: TreeDecoratorRegistry;
  readonly attributeHandlers: AttributeHandlerRegistry;
}
