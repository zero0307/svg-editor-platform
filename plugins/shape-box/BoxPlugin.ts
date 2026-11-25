import { BoxAttributeHandler } from './BoxAttributeHandler.js';
import { boxManifest } from './BoxManifest.js';
import { BoxProvider } from './BoxProvider.js';
import { BoxTypeLabelDecorator } from './BoxTypeLabelDecorator.js';
import type { PluginContext, PluginManifest, PluginModule } from '@svgframe/core';

/**
 * Plugin module for `@svgframe/shape-box`.
 *
 * One activation registers the three contributions of the box feature through the
 * staged context: the `box` shape provider, the `box-attributes` handler and the
 * `box-type-label` decorator. Nothing is written to the live registries here; the
 * installer compares the manifest with the staged names and commits all three or
 * discards the staging area together with a failed activation.
 */
export class BoxPlugin implements PluginModule {
  readonly manifest: PluginManifest = boxManifest;

  activate(context: PluginContext): void {
    context.shapeProviders.register(new BoxProvider());
    context.attributeHandlers.register(new BoxAttributeHandler());
    context.treeDecorators.register(new BoxTypeLabelDecorator());
  }
}
