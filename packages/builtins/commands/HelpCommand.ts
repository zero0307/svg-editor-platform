import { CommandArguments } from './CommandArguments.js';
import type {
  Command,
  CommandPreparation,
  CommandRegistry,
  ShapeProviderRegistry,
} from '@svgframe/core';

const QUOTE_NOTE = 'Quote arguments containing spaces. Lines starting with # are comments.';
const EOF_NOTE = 'End input with Ctrl+D (Unix) or Ctrl+Z then Enter (Windows).';

export class HelpCommand implements Command {
  readonly name = 'help';
  readonly usage = 'help';
  constructor(
    private readonly commands: CommandRegistry,
    private readonly providers: ShapeProviderRegistry,
  ) {}
  prepare(args: readonly string[]): CommandPreparation {
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(0);
    return {
      requiresDocument: false,
      effect: 'query',
      operation: { execute: () => this.lines() },
    };
  }
  private lines(): readonly string[] {
    const usages = this.commands.entries().map((command) => command.usage);
    const types = this.providers
      .entries()
      .map((provider) => provider.usage)
      .filter((usage): usage is string => usage !== undefined)
      .map((usage) => `  ${usage}`);
    return [...usages, '', 'Types:', ...types, QUOTE_NOTE, EOF_NOTE];
  }
}
