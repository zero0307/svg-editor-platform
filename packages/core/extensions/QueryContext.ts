import { DomainError } from '../domain/DomainError.js';
import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';

/**
 * Read-only execution context for a query command. It exposes the current
 * document only through the read-only projection and offers no session, edit or
 * history capability, so a query cannot mutate the live document.
 */
export class QueryContext {
  private readonly current: ReadonlyDocument | null;
  constructor(document: ReadonlyDocument | null) {
    this.current = document;
  }
  get hasDocument(): boolean {
    return this.current !== null;
  }
  document(): ReadonlyDocument {
    if (!this.current) throw new DomainError("no document. use 'init' or 'read' first");
    return this.current;
  }
}
