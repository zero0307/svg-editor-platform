import type { Context } from '@deepseek-ai/cordis';

/** Cordis plugin name used by loader diagnostics. */
export declare const name: string;

/** Host services this plugin requires. */
export declare const inject: string[];

export interface PluginConfig {
  /** Log registration and disposal to the host stdout. */
  log?: boolean;
  /** Pinned DSH version reported by `svgframe_probe`. */
  dshVersion?: string;
}

/** Register the minimal probe tool; the returned effect releases it on unload. */
export declare function apply(ctx: Context, config?: PluginConfig): void;
