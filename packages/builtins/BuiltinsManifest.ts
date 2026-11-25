import type { PluginManifest } from '@svgframe/core';

/** Manifest of the built-in default plugin; names match the registered objects. */
export const builtinsManifest: PluginManifest = {
  name: '@svgframe/builtins',
  version: '0.0.0',
  contributes: {
    shapes: ['rect', 'circle', 'ellipse', 'line', 'text', 'g'],
    commands: [
      'init',
      'read',
      'save',
      'canvas',
      'create',
      'delete',
      'move',
      'scale',
      'set',
      'group',
      'ungroup',
      'addto',
      'front',
      'back',
      'tree',
      'show',
      'undo',
      'redo',
      'help',
    ],
  },
};
