import { ModifiedStarDecorator } from './ModifiedStarDecorator.js';
import { modifiedStarManifest } from './ModifiedStarManifest.js';
import type { PluginContext, PluginManifest, PluginModule } from '@svgframe/core';

/**
 * Plugin module for `@svgframe/tree-modified`.
 *
 * `activate` registers one decorator on the staged context and subscribes its
 * instance to committed editor events through the same staged context. The host
 * publishes registrations first and only then connects staged subscriptions, and
 * a failed activation discards both, so the label never observes events it was not
 * successfully installed for. The plugin does not touch the live document, history
 * or the tree renderer.
 */
export class ModifiedStarPlugin implements PluginModule {
  readonly manifest: PluginManifest = modifiedStarManifest;
  activate(context: PluginContext): void {
    const decorator = new ModifiedStarDecorator();
    context.treeDecorators.register(decorator);
    context.subscribe((event) => decorator.onEvent(event));
  }
}
