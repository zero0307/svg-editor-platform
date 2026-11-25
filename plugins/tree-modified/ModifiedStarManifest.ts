import type { PluginManifest } from '@svgframe/core';

/**
 * Declared contributions of `@svgframe/tree-modified`.
 *
 * The A composition root passes this value to `PluginInstaller.install`; the B
 * loader derives the same manifest from this package's `package.json`
 * (`svgframe.contributes`). The single decorator is registered together with its
 * staged event subscription, so activation failure leaves neither behind.
 */
export const modifiedStarManifest: PluginManifest = {
  name: '@svgframe/tree-modified',
  version: '0.0.0',
  contributes: {
    decorators: ['modified-star'],
  },
};
