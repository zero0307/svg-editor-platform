import { DemoAttributeHandler } from './DemoAttributeHandler.js';
import { DemoBoxProvider } from './DemoBoxProvider.js';
import { DemoCreateCommand } from './DemoCreateCommand.js';
import { DemoQueryCommand } from './DemoQueryCommand.js';
import { DemoTreeDecorator } from './DemoTreeDecorator.js';
import type { PluginContext, PluginManifest, PluginModule, ReadonlyDocument } from '../../index.js';

/**
 * Consumer example of `PluginModule` + `PluginContext`: `activate` only registers
 * contributions through the staged context, using the injected public services.
 */
export class DemoPlugin implements PluginModule {
  readonly manifest: PluginManifest = {
    name: '@svgframe/demo-plugin',
    version: '0.0.0',
    contributes: {
      shapes: ['demo-box'],
      commands: ['demo-create', 'demo-stats'],
      decorators: ['demo-star'],
      attributeHandlers: ['demo-attributes'],
    },
  };
  activate(context: PluginContext): void {
    context.shapeProviders.register(new DemoBoxProvider());
    context.commands.register(new DemoCreateCommand(context.shapes));
    context.commands.register(
      new DemoQueryCommand('demo-stats', true, (document: ReadonlyDocument | null) =>
        document
          ? `demo-boxes ${document.all().filter((shape) => shape.kind === 'demo-box').length}`
          : 'demo-boxes 0',
      ),
    );
    context.treeDecorators.register(new DemoTreeDecorator());
    context.attributeHandlers.register(new DemoAttributeHandler());
  }
}
