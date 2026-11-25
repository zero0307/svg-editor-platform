import { ScaleAction } from '../actions/ScaleAction.js';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class ScaleCommand implements Command {
  readonly name = 'scale';
  readonly usage = 'scale <id> <factor>';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(2);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new ScaleAction(arguments_.value(0), arguments_.number(1)),
    };
  }
}
