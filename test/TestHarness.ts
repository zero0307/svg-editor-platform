import assert from 'node:assert/strict';
import {
  AttributeHandlerRegistry,
  CommandRegistry,
  DomainError,
  EditorSession,
  ProviderShapeCreationService,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
  TreePresenter,
} from '@svgframe/core';
import { CommandDispatcher } from '@svgframe/cli';
import { registerDefaultCommands, registerDefaultShapes } from '@svgframe/builtins';
import { XmlSvgCodec } from '@svgframe/svg-xml';
import type { FileStore } from '@svgframe/core';

/**
 * Phase 1 test harness rebuilt from the public packages: default providers and
 * commands are registered into live registries, the session owns the candidate
 * transaction, and the dispatcher applies only metadata routing.
 */
export class TestHarness implements FileStore {
  readonly files = new Map<string, string>();
  readonly shapeProviders = new ShapeProviderRegistry();
  readonly commands = new CommandRegistry();
  readonly treeDecorators = new TreeDecoratorRegistry();
  readonly attributeHandlers = new AttributeHandlerRegistry();
  readonly shapes = new ProviderShapeCreationService(this.shapeProviders);
  readonly codec = new XmlSvgCodec(this.shapeProviders);
  readonly editor = new EditorSession(this, this.codec);
  readonly presenter = new TreePresenter(this.treeDecorators);
  readonly router: CommandDispatcher;
  constructor() {
    registerDefaultShapes(this.shapeProviders);
    registerDefaultCommands(this.commands, {
      shapes: this.shapes,
      commands: this.commands,
      shapeProviders: this.shapeProviders,
      treeDecorators: this.treeDecorators,
      attributeHandlers: this.attributeHandlers,
    });
    this.router = new CommandDispatcher(this.commands, this.editor);
  }
  async read(path: string): Promise<string> {
    if (!this.files.has(path)) throw new DomainError(`cannot read file: ${path}`);
    return this.files.get(path)!;
  }
  async write(path: string, content: string): Promise<void> {
    if (path === 'readonly.svg') throw new DomainError(`cannot write file: ${path}`);
    this.files.set(path, content);
  }
  async run(...lines: string[]): Promise<void> {
    for (const line of lines) {
      const output = await this.router.execute(line);
      assert.equal(
        output.some((message) => message.startsWith('error:')),
        false,
        `${line}: ${output.join('\n')}`,
      );
    }
  }
  snapshot(): string {
    return this.codec.encode(this.editor.document());
  }
  ids(parentId?: string): readonly string[] {
    const document = this.editor.document();
    return (parentId ? document.container(parentId) : document.root)
      .children()
      .map((shape) => shape.id);
  }
}
