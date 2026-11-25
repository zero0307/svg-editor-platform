import type { PluginManifest } from '@svgframe/core';

/**
 * Declared contributions of `@svgframe/shape-box`.
 *
 * The A composition root passes this value to `PluginInstaller.install`; the B
 * loader derives the same manifest from this package's `package.json`
 * (`svgframe.contributes`). The three names are registered together by one
 * `activate`, so the installer commits or rolls them back atomically.
 */
export const boxManifest: PluginManifest = {
  name: '@svgframe/shape-box',
  version: '0.0.0',
  contributes: {
    shapes: ['box'],
    attributeHandlers: ['box-attributes'],
    decorators: ['box-type-label'],
  },
};
