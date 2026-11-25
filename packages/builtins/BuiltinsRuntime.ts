import type {
  AttributeHandlerRegistry,
  CommandRegistry,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
} from '@svgframe/core';

/** Live registries the built-in command instances observe at execution time. */
export interface BuiltinsRuntime {
  readonly commands: CommandRegistry;
  readonly shapeProviders: ShapeProviderRegistry;
  readonly treeDecorators: TreeDecoratorRegistry;
  readonly attributeHandlers: AttributeHandlerRegistry;
}
