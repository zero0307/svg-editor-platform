import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class InitCommand implements Command {
  readonly name = 'init';
  readonly usage = 'init [w] [h]';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(0, 2);
    const width = arguments_.length ? arguments_.number(0) : 800;
    const height = arguments_.length > 1 ? arguments_.number(1) : 600;
    return {
      requiresDocument: false,
      effect: 'document',
      operation: { execute: (session) => session.init(width, height) },
    };
  }
}
