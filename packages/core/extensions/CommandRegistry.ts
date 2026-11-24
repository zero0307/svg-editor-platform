import { Registry } from './Registry.js';
import type { Command } from './Command.js';

/** Commands keyed by their stable command name. */
export class CommandRegistry extends Registry<Command> {
  protected override keyOf(contribution: Command): string {
    return contribution.name;
  }
  protected override kind(): string {
    return 'command';
  }
}
