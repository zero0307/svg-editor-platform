import type { PluginManifest } from '@svgframe/core';

/**
 * Declared contributions of `@svgframe/command-dir`.
 *
 * The A composition root passes this value to `PluginInstaller.install`; the B
 * loader derives the same manifest from this package's `package.json`
 * (`svgframe.contributes`). The plugin test asserts the declaration matches the
 * names actually registered.
 */
export const commandDirManifest: PluginManifest = {
  name: '@svgframe/command-dir',
  version: '0.0.0',
  contributes: {
    commands: ['dir'],
  },
};
