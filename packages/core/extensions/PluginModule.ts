import type { PluginContext } from './PluginContext.js';
import type { PluginManifest } from './PluginManifest.js';

/**
 * Contract of a plugin's default export. `activate` registers contributes only
 * through the staged context; the host commits or discards them atomically.
 * Module top-level code must stay free of external side effects.
 */
export interface PluginModule {
  readonly manifest: PluginManifest;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
