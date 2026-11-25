import { AttributeEditAction, AttributeEditingService } from '@svgframe/core';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class SetCommand implements Command {
  readonly name = 'set';
  readonly usage = 'set <id> <attr> <value>';
  constructor(private readonly attributes: AttributeEditingService) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(3);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new AttributeEditAction(this.attributes, {
        targetId: arguments_.value(0),
        attribute: arguments_.value(1),
        value: arguments_.value(2),
      }),
    };
  }
}
