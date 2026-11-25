import { FrontAction } from '../actions/FrontAction.js';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class FrontCommand implements Command {
  readonly name = 'front';
  readonly usage = 'front <id>';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(1);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new FrontAction(arguments_.value(0)),
    };
  }
}
