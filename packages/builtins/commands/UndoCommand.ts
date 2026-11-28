import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class UndoCommand implements Command {
  readonly name = 'undo';
  readonly usage = 'undo';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(0);
    return {
      requiresDocument: true,
      effect: 'history',
      operation: { execute: (session) => session.undo() },
    };
  }
}
