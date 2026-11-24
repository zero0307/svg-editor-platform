/**
 * Declared contributions of one plugin. The loader compares these name sets with
 * the staged registrations before committing them (A/B share this path).
 */
export interface PluginContributions {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly decorators?: readonly string[];
  readonly attributeHandlers?: readonly string[];
}

/** Stable plugin identity; `name` is the package/module identity, not a registry key. */
export interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly contributes?: PluginContributions;
}
