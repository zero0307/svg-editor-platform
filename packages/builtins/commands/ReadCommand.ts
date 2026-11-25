import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class ReadCommand implements Command {
  readonly name = 'read';
  readonly usage = 'read <file.svg>';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(1);
    const path = arguments_.value(0);
    return {
      requiresDocument: false,
      effect: 'document',
      operation: { execute: (session) => session.read(path) },
    };
  }
}
