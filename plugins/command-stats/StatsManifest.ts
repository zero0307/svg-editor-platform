import type { PluginManifest } from '@svgframe/core';

/**
 * Declared contributions of `@svgframe/command-stats`.
 *
 * The A composition root passes this value to `PluginInstaller.install`; the B
 * loader derives the same manifest from this package's `package.json`
 * (`svgframe.contributes`). Both must stay identical, and the plugin test asserts
 * the `package.json` declaration matches the names actually registered.
 */
export const commandStatsManifest: PluginManifest = {
  name: '@svgframe/command-stats',
  version: '0.0.0',
  contributes: {
    commands: ['stats'],
  },
};
