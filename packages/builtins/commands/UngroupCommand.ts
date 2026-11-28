import { StructureService, UngroupAction } from '@svgframe/core';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class UngroupCommand implements Command {
  readonly name = 'ungroup';
  readonly usage = 'ungroup <gid>';
  constructor(private readonly structure: StructureService) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(1);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new UngroupAction(this.structure, arguments_.value(0)),
    };
  }
}
