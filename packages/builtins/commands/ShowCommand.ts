import { TreePresenter } from '@svgframe/core';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class ShowCommand implements Command {
  readonly name = 'show';
  readonly usage = 'show <id>';
  constructor(private readonly presenter: TreePresenter) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(1);
    const id = arguments_.value(0);
    return {
      requiresDocument: true,
      effect: 'query',
      operation: { execute: (context) => this.presenter.show(context.document(), id) },
    };
  }
}
