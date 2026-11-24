import { DomainError, QueryContext } from '../../index.js';
import type { CommandOutput, CommandRegistry, EditorSessionPort } from '../../index.js';

/**
 * Contract example of the command dispatcher: it reads only `requiresDocument`
 * and `effect` from the preparation result. Command names are looked up in the
 * registry but never used to decide prerequisites, effects or special cases, so a
 * command can be added without editing this dispatcher.
 */
export class SampleCommandDispatcher {
  constructor(
    private readonly commands: CommandRegistry,
    private readonly session: EditorSessionPort,
  ) {}
  async execute(name: string, args: readonly string[] = []): Promise<CommandOutput> {
    const command = this.commands.require(name);
    const preparation = command.prepare(args);
    if (preparation.requiresDocument) this.session.document();
    switch (preparation.effect) {
      case 'query':
        return preparation.operation.execute(
          new QueryContext(this.session.hasDocument() ? this.session.document() : null),
        );
      case 'edit':
        return this.session.edit(preparation.action);
      case 'document':
        return preparation.operation.execute(this.session);
      case 'history':
        return preparation.operation.execute(this.session);
      default:
        return SampleCommandDispatcher.unreachable(preparation);
    }
  }
  private static unreachable(preparation: never): never {
    throw new DomainError(`unsupported command effect: ${String(preparation)}`);
  }
}
