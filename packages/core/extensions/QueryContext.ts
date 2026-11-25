import { DomainError } from '../domain/DomainError.js';
import type { DirectoryReader } from '../ports/DirectoryReader.js';
import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';

/**
 * Read-only execution context for a query command.
 *
 * It exposes the current document only through the read-only projection, the
 * public directory port for commands such as `dir`, and no session, edit or
 * history capability, so a query cannot mutate the live document or its history.
 */
export class QueryContext {
  private readonly current: ReadonlyDocument | null;
  private readonly directoryReader: DirectoryReader | null;
  constructor(document: ReadonlyDocument | null, directories?: DirectoryReader) {
    this.current = document;
    this.directoryReader = directories ?? null;
  }
  get hasDocument(): boolean {
    return this.current !== null;
  }
  document(): ReadonlyDocument {
    if (!this.current) throw new DomainError("no document. use 'init' or 'read' first");
    return this.current;
  }
  directories(): DirectoryReader {
    if (!this.directoryReader) throw new DomainError('directory access is not available');
    return this.directoryReader;
  }
}
