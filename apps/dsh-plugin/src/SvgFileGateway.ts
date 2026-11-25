/** One resolved file in the host's execution world. */
export interface SvgFileTarget {
  /** Human-readable path used in results and error messages. */
  readonly displayPath: string;
}

/** Cheap metadata the gateway exposes without reading content. */
export interface SvgFileInfo {
  readonly size: number | undefined;
}

/**
 * File capability injected by the DSH host.
 *
 * The plugin never imports Node's `fs`; every read and write goes through
 * `ctx.fs` so the host keeps owning path resolution and write policy.
 */
export interface SvgFileGateway {
  resolve(path: string, options?: { signal?: AbortSignal }): Promise<SvgFileTarget>;
  stat(target: SvgFileTarget, signal?: AbortSignal): Promise<SvgFileInfo | undefined>;
  readText(target: SvgFileTarget, signal?: AbortSignal): Promise<string>;
  writeText(target: SvgFileTarget, content: string, signal?: AbortSignal): Promise<void>;
}
