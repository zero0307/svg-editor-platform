import { builtinsManifest } from './BuiltinsManifest.js';
import { registerDefaultCommands } from './registerDefaultCommands.js';
import { registerDefaultShapes } from './registerDefaultShapes.js';
import type { BuiltinsRuntime } from './BuiltinsRuntime.js';
import type { PluginContext, PluginManifest, PluginModule } from '@svgframe/core';

/**
 * Built-in plugin module installed through the same `PluginInstaller` as optional
 * plugins (A/B). Shapes and commands are staged by the installer; command
 * instances receive the live registries from the composition root so help and
 * later plugin contributions are observed at execution time.
 */
export class BuiltinsPlugin implements PluginModule {
  readonly manifest: PluginManifest = builtinsManifest;
  constructor(private readonly runtime: BuiltinsRuntime) {}
  activate(context: PluginContext): void {
    registerDefaultShapes(context.shapeProviders);
    registerDefaultCommands(context.commands, {
      shapes: context.shapes,
      commands: this.runtime.commands,
      shapeProviders: this.runtime.shapeProviders,
      treeDecorators: this.runtime.treeDecorators,
      attributeHandlers: this.runtime.attributeHandlers,
    });
  }
}
