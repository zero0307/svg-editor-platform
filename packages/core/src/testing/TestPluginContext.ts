import type {
  AttributeHandler,
  Command,
  PluginContext,
  PluginOptions,
  ShapeProvider,
  TreeDecorator,
} from '../index.js';

// A per-test registration surface. Real manifest validation and activation rollback belong to host.
export class TestPluginContext implements PluginContext {
  readonly shapes = new Map<string, ShapeProvider>();
  readonly commands = new Map<string, Command>();
  readonly decorators = new Map<string, TreeDecorator>();
  readonly attributes = new Map<string, AttributeHandler>();
  constructor(readonly options: PluginOptions = {}) {}
  registerShape(value: ShapeProvider): void {
    this.add('shapes', this.shapes, value);
  }
  registerCommand(value: Command): void {
    this.add('commands', this.commands, value);
  }
  registerDecorator(value: TreeDecorator): void {
    this.add('decorators', this.decorators, value);
  }
  registerAttribute(value: AttributeHandler): void {
    this.add('attributes', this.attributes, value);
  }
  private add<T extends { readonly name: string }>(
    category: string,
    list: Map<string, T>,
    value: T,
  ): void {
    if (list.has(value.name))
      throw new Error('duplicate registration: ' + category + '/' + value.name);
    list.set(value.name, value);
  }
}
