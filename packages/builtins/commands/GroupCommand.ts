import { GroupAction, StructureService } from '@svgframe/core';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class GroupCommand implements Command {
  readonly name = 'group';
  readonly usage = 'group <newGid> <id1> <id2>...';
  constructor(private readonly structure: StructureService) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(2, Infinity);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new GroupAction(this.structure, arguments_.value(0), arguments_.values(1)),
    };
  }
}
