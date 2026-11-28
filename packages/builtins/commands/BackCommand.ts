import { BackAction } from '../actions/BackAction.js';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class BackCommand implements Command {
  readonly name = 'back';
  readonly usage = 'back <id>';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(1);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new BackAction(arguments_.value(0)),
    };
  }
}
