import { DomainError } from '@svgframe/core';
import { DirListing } from './DirListing.js';
import type { Command, CommandPreparation } from '@svgframe/core';

/**
 * Independent `dir` command: list the CLI process working directory.
 *
 * It needs no document (`requiresDocument:false`) and is a read-only `query`, so
 * the dispatcher supplies a `QueryContext` with only the read-only document and
 * the directory port. The command reads directories exclusively through
 * `context.directories()` and never imports Node `fs`, `process.cwd` or a host
 * adapter. `dir` takes no arguments; a wrong count reports the Phase 1 style
 * `usage: dir` error that the dispatcher prefixes with `error: `.
 */
export class DirCommand implements Command {
  readonly name = 'dir';
  readonly usage = 'dir';
  private readonly listing = new DirListing();
  prepare(args: readonly string[]): CommandPreparation {
    if (args.length !== 0) throw new DomainError(`usage: ${this.usage}`);
    return {
      requiresDocument: false,
      effect: 'query',
      operation: { execute: (context) => this.listing.render(context.directories()) },
    };
  }
}
