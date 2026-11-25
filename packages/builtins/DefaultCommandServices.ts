import type {
  AttributeHandlerRegistry,
  CommandRegistry,
  ShapeCreationService,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
} from '@svgframe/core';

/** Live collaborators the default commands are constructed with. */
export interface DefaultCommandServices {
  readonly shapes: ShapeCreationService;
  readonly commands: CommandRegistry;
  readonly shapeProviders: ShapeProviderRegistry;
  readonly treeDecorators: TreeDecoratorRegistry;
  readonly attributeHandlers: AttributeHandlerRegistry;
}
