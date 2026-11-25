/** Stable failure codes for plugin loading and installation. */
export type PluginLoadErrorCode =
  | 'module-not-found'
  | 'missing-default-export'
  | 'activation-failed'
  | 'duplicate-registration'
  | 'manifest-mismatch'
  | 'invalid-config';

/**
 * Structured plugin load/install failure.
 *
 * The message is the exact user-facing text frozen by Issue #8 and never carries
 * an `error:` prefix; the CLI composition root decides how to print it.
 */
export class PluginLoadError extends Error {
  constructor(
    readonly code: PluginLoadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PluginLoadError';
  }
}
