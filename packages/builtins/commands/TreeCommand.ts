import { TreePresenter } from '@svgframe/core';
import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class TreeCommand implements Command {
  readonly name = 'tree';
  readonly usage = 'tree [id]';
  constructor(private readonly presenter: TreePresenter) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(0, 1);
    const id = arguments_.length ? arguments_.value(0) : undefined;
    return {
      requiresDocument: true,
      effect: 'query',
      operation: { execute: (context) => this.presenter.tree(context.document(), id) },
    };
  }
}
