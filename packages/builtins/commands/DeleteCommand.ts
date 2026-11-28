import { DeleteAction, StructureService } from '@svgframe/core';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class DeleteCommand implements Command {
  readonly name = 'delete';
  readonly usage = 'delete <id>';
  constructor(private readonly structure: StructureService) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(1);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new DeleteAction(this.structure, arguments_.value(0)),
    };
  }
}
