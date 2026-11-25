import type { PluginLoadError } from './PluginLoadError.js';

/**
 * Structured result of installing one plugin. A/B composition roots share this
 * shape, so both can print the same messages and keep loading later plugins.
 */
export type PluginInstallResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly error: PluginLoadError };
