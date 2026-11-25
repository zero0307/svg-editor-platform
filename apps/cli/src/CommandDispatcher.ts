import { DomainError, QueryContext } from '@svgframe/core';
import { Tokenizer } from './Tokenizer.js';
import type {
  CommandOutput,
  CommandRegistry,
  CommandToken,
  EditorSessionPort,
} from '@svgframe/core';

/**
 * Metadata-driven command dispatcher.
 *
 * It looks a command up by name, asks it for a preparation result and then routes
 * only by `requiresDocument` and `effect`. There is no command-name whitelist and
 * no domain knowledge here; every error is formatted as one `error:` line.
 */
export class CommandDispatcher {
  private readonly tokenizer = new Tokenizer();
  constructor(
    private readonly commands: CommandRegistry,
    private readonly session: EditorSessionPort,
  ) {}
  async execute(line: string): Promise<readonly string[]> {
    try {
      const tokens = this.tokenizer.tokenize(line);
      if (!tokens.length) return [];
      return await this.executeTokens(tokens);
    } catch (error) {
      return [CommandDispatcher.errorLine(error)];
    }
  }
  /** Executes already-tokenized input; throws instead of formatting errors. */
  async executeTokens(tokens: readonly CommandToken[]): Promise<readonly string[]> {
    const name = tokens[0]!.value;
    const command = this.commands.get(name);
    if (!command) throw new DomainError(`unknown command: ${name}`);
    const args = tokens.slice(1);
    const preparation = command.prepareTokens
      ? command.prepareTokens(args)
      : command.prepare(args.map((token) => token.value));
    if (preparation.requiresDocument) this.session.document();
    switch (preparation.effect) {
      case 'query':
        return CommandDispatcher.normalize(
          await preparation.operation.execute(
            new QueryContext(this.session.hasDocument() ? this.session.document() : null),
          ),
        );
      case 'edit':
        return CommandDispatcher.normalize(this.session.edit(preparation.action));
      case 'document':
        return CommandDispatcher.normalize(await preparation.operation.execute(this.session));
      case 'history':
        return CommandDispatcher.normalize(await preparation.operation.execute(this.session));
      default:
        return CommandDispatcher.unreachable(preparation);
    }
  }
  help(): Promise<readonly string[]> {
    return this.execute('help');
  }
  private static normalize(output: CommandOutput): readonly string[] {
    return typeof output === 'string' ? [output] : output;
  }
  private static unreachable(preparation: never): never {
    throw new DomainError(`unsupported command effect: ${String(preparation)}`);
  }
  private static errorLine(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return `error: ${message.replace(/[\r\n]+/g, ' ')}`;
  }
}
