import { DomainError } from '../domain/DomainError.js';
import type { SvgDocument } from '../domain/SvgDocument.js';

interface HistoryEntry {
  readonly before: SvgDocument;
  readonly after: SvgDocument;
  readonly message: string;
}

/**
 * Internal undo/redo stacks of the editing session.
 *
 * Entries are already validated document snapshots; undo/redo only swap them and
 * never re-run edit actions or attribute handlers. The stacks are private: plugins
 * cannot read or mutate history, they only observe committed events.
 */
export class EditHistory {
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private blocked = false;
  record(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    this.redoStack.length = 0;
    this.blocked = false;
  }
  barrier(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.blocked = true;
  }
  undo(): HistoryEntry {
    this.check();
    const entry = this.undoStack.pop();
    if (!entry) throw new DomainError('nothing to undo');
    this.redoStack.push(entry);
    return entry;
  }
  redo(): HistoryEntry {
    this.check();
    const entry = this.redoStack.pop();
    if (!entry) throw new DomainError('nothing to redo');
    this.undoStack.push(entry);
    return entry;
  }
  private check(): void {
    if (this.blocked) throw new DomainError('undo not allowed after io command');
  }
}
