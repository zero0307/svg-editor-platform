import type { AttributeHandlerRegistry } from './AttributeHandlerRegistry.js';
import type { CommandRegistry } from './CommandRegistry.js';
import type { ShapeProviderRegistry } from './ShapeProviderRegistry.js';
import type { TreeDecoratorRegistry } from './TreeDecoratorRegistry.js';
import type { DirectoryReader } from '../ports/DirectoryReader.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';
import type { EditorEventListener } from '../events/EditorEvent.js';

/**
 * Capabilities available to `activate`: validated read-only options, the public
 * shape/directory service ports and the four registration tables.
 *
 * The host passes staged registries here; nothing in this context exposes the
 * live document, the filesystem, history or an untyped event bus. `subscribe`
 * only accepts committed editor events and is staged by the host: a failed or
 * rolled-back plugin never reaches the live event bus.
 */
export interface PluginContext {
  readonly options: Readonly<Record<string, unknown>>;
  readonly shapes: ShapeCreationService;
  readonly directories: DirectoryReader;
  readonly shapeProviders: ShapeProviderRegistry;
  readonly commands: CommandRegistry;
  readonly treeDecorators: TreeDecoratorRegistry;
  readonly attributeHandlers: AttributeHandlerRegistry;
  /** Subscribe to committed editor events; returns an unsubscribe function. */
  subscribe(listener: EditorEventListener): () => void;
}
