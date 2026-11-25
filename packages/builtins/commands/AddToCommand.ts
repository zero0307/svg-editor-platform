import { AddToAction, StructureService } from '@svgframe/core';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class AddToCommand implements Command {
  readonly name = 'addto';
  readonly usage = 'addto <gid> <id>';
  constructor(private readonly structure: StructureService) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(2);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new AddToAction(this.structure, arguments_.value(0), arguments_.value(1)),
    };
  }
}
