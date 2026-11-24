import { AttributeHandlerRegistry } from '../extensions/AttributeHandlerRegistry.js';
import { CommandRegistry } from '../extensions/CommandRegistry.js';
import { ShapeProviderRegistry } from '../extensions/ShapeProviderRegistry.js';
import { TreeDecoratorRegistry } from '../extensions/TreeDecoratorRegistry.js';
import { FakeDirectoryReader } from './FakeDirectoryReader.js';
import { FakeShapeCreationService } from './FakeShapeCreationService.js';
import type { DirectoryReader } from '../ports/DirectoryReader.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';
import type { PluginContext } from '../extensions/PluginContext.js';

/**
 * Stand-in plugin activation context with fresh staged registries and fake
 * service ports. Plugins can call `activate` against it and be tested without the
 * host loader, filesystem, live document or history.
 */
export class FakePluginContext implements PluginContext {
  readonly shapeProviders = new ShapeProviderRegistry();
  readonly commands = new CommandRegistry();
  readonly treeDecorators = new TreeDecoratorRegistry();
  readonly attributeHandlers = new AttributeHandlerRegistry();
  constructor(
    readonly options: Readonly<Record<string, unknown>> = {},
    readonly shapes: ShapeCreationService = new FakeShapeCreationService(),
    readonly directories: DirectoryReader = new FakeDirectoryReader(),
  ) {}
}
