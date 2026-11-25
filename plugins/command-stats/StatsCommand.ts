import { DomainError } from '@svgframe/core';
import { StatsTally } from './StatsTally.js';
import type { Command, CommandPreparation } from '@svgframe/core';

/**
 * Independent `stats` command: read-only document statistics.
 *
 * It declares its prerequisites and effect instead of relying on a name
 * whitelist: a document is required, the effect is `query`, so the dispatcher
 * hands it the read-only projection and never the session, history or barrier.
 * `stats` accepts no arguments; a wrong count reports the Phase 1 style
 * `usage: <usage>` error that the dispatcher prefixes with `error: `.
 */
export class StatsCommand implements Command {
  readonly name = 'stats';
  readonly usage = 'stats';
  private readonly tally = new StatsTally();
  prepare(args: readonly string[]): CommandPreparation {
    if (args.length !== 0) throw new DomainError(`usage: ${this.usage}`);
    return {
      requiresDocument: true,
      effect: 'query',
      operation: { execute: (context) => this.tally.report(context.document()) },
    };
  }
}
