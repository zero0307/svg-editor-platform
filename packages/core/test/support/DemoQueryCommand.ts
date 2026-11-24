import { DomainError } from '../../index.js';
import type { Command, CommandOutput, CommandPreparation, ReadonlyDocument } from '../../index.js';

/**
 * Consumer example of a query-effect command with a configurable name, so tests
 * can prove that prerequisites come from `requiresDocument`, not from a name
 * whitelist (a command literally named `read` still requires a document here).
 */
export class DemoQueryCommand implements Command {
  constructor(
    readonly name: string,
    private readonly requiresDocument = true,
    private readonly output: (document: ReadonlyDocument | null) => CommandOutput = (document) =>
      document ? `elements ${document.all().length}` : 'no document',
  ) {}
  get usage(): string {
    return this.name;
  }
  prepare(args: readonly string[]): CommandPreparation {
    if (args.length !== 0) throw new DomainError(`usage: ${this.name}`);
    return {
      requiresDocument: this.requiresDocument,
      effect: 'query',
      operation: {
        execute: (context) => this.output(this.requiresDocument ? context.document() : null),
      },
    };
  }
}
