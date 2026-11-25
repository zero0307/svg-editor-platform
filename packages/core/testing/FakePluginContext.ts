import { AttributeHandlerRegistry } from '../extensions/AttributeHandlerRegistry.js';
import { CommandRegistry } from '../extensions/CommandRegistry.js';
import { ShapeProviderRegistry } from '../extensions/ShapeProviderRegistry.js';
import { TreeDecoratorRegistry } from '../extensions/TreeDecoratorRegistry.js';
import { EditorEventBus } from '../events/EditorEventBus.js';
import { FakeDirectoryReader } from './FakeDirectoryReader.js';
import { FakeShapeCreationService } from './FakeShapeCreationService.js';
import type { DirectoryReader } from '../ports/DirectoryReader.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';
import type { EditorEvent, EditorEventListener } from '../events/EditorEvent.js';
import type { PluginContext } from '../extensions/PluginContext.js';

/**
 * Stand-in plugin activation context with fresh staged registries and fake
 * service ports. Plugins can call `activate` against it and be tested without the
 * host loader, filesystem, live document or history. `publish` lets a test drive
 * the same committed events the host would forward to a successfully installed
 * plugin.
 */
export class FakePluginContext implements PluginContext {
  readonly shapeProviders = new ShapeProviderRegistry();
  readonly commands = new CommandRegistry();
  readonly treeDecorators = new TreeDecoratorRegistry();
  readonly attributeHandlers = new AttributeHandlerRegistry();
  private readonly events = new EditorEventBus();
  constructor(
    readonly options: Readonly<Record<string, unknown>> = {},
    readonly shapes: ShapeCreationService = new FakeShapeCreationService(),
    readonly directories: DirectoryReader = new FakeDirectoryReader(),
  ) {}
  subscribe(listener: EditorEventListener): () => void {
    return this.events.subscribe(listener);
  }
  /** Test helper: deliver one committed event to current subscribers. */
  publish(event: EditorEvent): void {
    this.events.publish(event);
  }
}
