import { MoveAction } from '../actions/MoveAction.js';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class MoveCommand implements Command {
  readonly name = 'move';
  readonly usage = 'move <id> <dx> <dy>';
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(3);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new MoveAction(arguments_.value(0), arguments_.number(1), arguments_.number(2)),
    };
  }
}
