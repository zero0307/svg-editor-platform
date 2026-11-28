import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class SaveCommand implements Command {
  readonly name = 'save';
  readonly usage = 'save [file.svg]';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(0, 1);
    const path = arguments_.length ? arguments_.value(0) : undefined;
    return {
      requiresDocument: true,
      effect: 'document',
      operation: { execute: (session) => session.save(path) },
    };
  }
}
