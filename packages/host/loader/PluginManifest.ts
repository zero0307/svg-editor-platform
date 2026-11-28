import type { PluginManifest } from '@svgframe/core';

const asRecord = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`invalid plugin manifest: ${what} must be an object`);
  return value as Record<string, unknown>;
};

const requiredString = (value: unknown, what: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`invalid plugin manifest: ${what} must be a non-empty string`);
  return value;
};

const stringArray = (value: unknown, what: string): readonly string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`invalid plugin manifest: ${what} must be an array`);
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || !entry.trim())
      throw new Error(`invalid plugin manifest: ${what}[${index}] must be a non-empty string`);
    return entry;
  });
};

/**
 * Normalize the plugin package manifest into core's `PluginManifest`.
 *
 * The authoritative source is the plugin package's own `package.json`:
 * `{ name, version, svgframe: { contributes: { shapes, commands, decorators, attributes } } }`.
 * `attributes` maps to core's `attributeHandlers`; a core-shaped manifest
 * (`contributes.attributeHandlers`, for example passed by composition root A) is
 * accepted as well so both entry points produce the same value.
 */
export function normalizePluginManifest(value: unknown): PluginManifest {
  const raw = asRecord(value, 'manifest');
  const name = requiredString(raw.name, 'name');
  const version = requiredString(raw.version, 'version');
  const svgframe = raw.svgframe === undefined ? undefined : asRecord(raw.svgframe, 'svgframe');
  const source: Record<string, unknown> =
    svgframe?.contributes !== undefined
      ? asRecord(svgframe.contributes, 'svgframe.contributes')
      : raw.contributes === undefined
        ? {}
        : asRecord(raw.contributes, 'contributes');
  const attributeSource = source.attributeHandlers ?? source.attributes;
  return {
    name,
    version,
    contributes: {
      shapes: stringArray(source.shapes, 'contributes.shapes'),
      commands: stringArray(source.commands, 'contributes.commands'),
      decorators: stringArray(source.decorators, 'contributes.decorators'),
      attributeHandlers: stringArray(attributeSource, 'contributes.attributes'),
    },
  };
}
