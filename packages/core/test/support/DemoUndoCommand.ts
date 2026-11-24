import { DomainError } from '../../index.js';
import type { Command, CommandPreparation } from '../../index.js';

/** Consumer example of a history-effect command. */
export class DemoUndoCommand implements Command {
  readonly name = 'demo-undo';
  readonly usage = 'demo-undo';
  prepare(args: readonly string[]): CommandPreparation {
    if (args.length !== 0) throw new DomainError(`usage: ${this.usage}`);
    return {
      requiresDocument: true,
      effect: 'history',
      operation: { execute: (session) => session.undo() },
    };
  }
}
