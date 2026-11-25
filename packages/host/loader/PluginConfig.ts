/** One entry of `plugins.config.json`. */
export interface PluginConfigEntry {
  readonly module: string;
  readonly options?: Readonly<Record<string, unknown>>;
  readonly enabled?: boolean;
}

/** Validated shape of `plugins.config.json`. */
export interface PluginConfig {
  readonly plugins: readonly PluginConfigEntry[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseEntry = (value: unknown): PluginConfigEntry => {
  if (!isRecord(value)) throw new Error('invalid plugin config');
  const module = value.module;
  if (typeof module !== 'string' || !module.trim()) throw new Error('invalid plugin config');
  if (value.options !== undefined && !isRecord(value.options))
    throw new Error('invalid plugin config');
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean')
    throw new Error('invalid plugin config');
  return {
    module,
    ...(value.options === undefined
      ? {}
      : { options: value.options as Readonly<Record<string, unknown>> }),
    ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
  };
};

/**
 * Parse and validate the B-mode configuration.
 *
 * Every structural problem (JSON syntax, missing `plugins` array, non-string
 * module, non-object options, non-boolean enabled) collapses to the frozen
 * `invalid plugin config` message; the caller falls back to the built-in
 * capabilities instead of partially loading the list.
 */
export function parsePluginConfig(source: string): PluginConfig {
  let value: unknown;
  try {
    value = JSON.parse(source.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('invalid plugin config');
  }
  if (!isRecord(value) || !Array.isArray(value.plugins)) throw new Error('invalid plugin config');
  return { plugins: value.plugins.map(parseEntry) };
}
