/** Structured author-facing schema DSL used by `ctx.tools.register(defineTool({...}))`. */
export type DshParameterSpec =
  | { type: 'string'; required?: true; description?: string }
  | { type: 'number'; required?: true; description?: string }
  | { type: 'integer'; required?: true; description?: string }
  | { type: 'boolean'; required?: true; description?: string }
  | { type: 'array'; required?: true; description?: string; items?: DshParameterSpec }
  | {
      type: 'object';
      required?: true;
      description?: string;
      additionalProperties: boolean;
      properties?: Record<string, DshParameterSpec>;
    };

/** One canonical result block rendered into the model-facing content. */
export interface DshTextContent {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Wire-level JSON Schema used by `output.schema`.
 *
 * Unlike the author-facing parameter DSL, this projection carries requiredness
 * as an object-level `required` array; an inline `required: true` is rejected by
 * the host validator.
 */
export interface DshJsonSchema {
  readonly type?: 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'array' | 'object';
  readonly description?: string;
  readonly properties?: Readonly<Record<string, DshJsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: DshJsonSchema;
  readonly enum?: readonly (string | number | boolean | null)[];
}

/** Tool definition accepted by the DSH tool registry. */
export interface DshToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, DshParameterSpec>;
  readonly output: {
    readonly schema: DshJsonSchema;
    readonly render: (args: Record<string, unknown>, value: unknown) => DshTextContent[];
  };
  readonly execute: (
    args: Record<string, unknown>,
    exec?: { readonly signal?: AbortSignal },
  ) => Promise<unknown>;
}

/** Registry projection of the host tool service. */
export interface DshToolRegistry {
  register(tool: DshToolDefinition): (() => void) | undefined;
  get(name: string): unknown;
}

/** Opaque target returned by the host filesystem service. */
export interface DshFsTarget {
  readonly displayPath: string;
}

/** Metadata returned by the host filesystem service. */
export interface DshFsInfo {
  readonly size?: number;
}

/** The `ctx.fs` capability this plugin consumes instead of Node file APIs. */
export interface DshFsService {
  resolve(path: string, options?: { signal?: AbortSignal }): Promise<DshFsTarget>;
  stat(target: DshFsTarget, signal?: AbortSignal): Promise<DshFsInfo | undefined>;
  readText(target: DshFsTarget, signal?: AbortSignal): Promise<string>;
  writeText(target: DshFsTarget, content: string, signal?: AbortSignal): Promise<unknown>;
}

/** The subset of the Cordis context this plugin relies on. */
export interface DshPluginContext {
  readonly tools: DshToolRegistry;
  readonly fs: DshFsService;
  effect(callback: () => () => void): void;
}
