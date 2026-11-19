import type { AttributeHandler, Command, ShapeProvider, TreeDecorator } from './extensions.js';

export interface Contributions {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly decorators?: readonly string[];
  readonly attributes?: readonly string[];
}

export interface PluginManifest {
  readonly name: string;
  readonly contributes: Contributions;
}

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type PluginOptions = Readonly<Record<string, JsonValue>>;

export interface PluginContext {
  readonly options: PluginOptions;
  registerShape(provider: ShapeProvider): void;
  registerCommand(command: Command): void;
  registerDecorator(decorator: TreeDecorator): void;
  registerAttribute(handler: AttributeHandler): void;
}

export interface PluginModule {
  activate(context: PluginContext): void | Promise<void>;
}
