import { DomainError } from '../domain/DomainError.js';
import { SvgDocument } from '../domain/SvgDocument.js';
import { EditorEventBus } from '../events/EditorEventBus.js';
import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';
import type { EditAction } from '../extensions/EditAction.js';
import type { EditorEvent } from '../events/EditorEvent.js';
import type { EditorEvents } from '../events/EditorEvents.js';
import type { EditorSessionPort } from '../ports/EditorSessionPort.js';

interface HistoryEntry {
  readonly before: SvgDocument;
  readonly after: SvgDocument;
  readonly message: string;
}

/**
 * In-memory `EditorSessionPort` test double.
 *
 * It keeps Phase 1 visible behavior (clone → apply → validate on edit, one undo
 * unit, I/O barrier on init/read/save/canvas resize, success-only events) but does
 * no real I/O or SVG parsing. Consumers use it to test commands without the
 * framework session implementation.
 */
export class FakeEditorSession implements EditorSessionPort {
  private current: SvgDocument | undefined;
  private currentPath: string | undefined;
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private readonly bus: EditorEventBus;
  private blocked = false;
  /** Call log, for example `init 800 600` or `edit`. */
  readonly invocations: string[] = [];
  /** Warnings returned by the next `read` calls. */
  readonly readWarnings: string[] = [];
  constructor(
    document?: SvgDocument,
    onObserverError?: (error: unknown, event: EditorEvent) => void,
  ) {
    if (document) this.current = document;
    this.bus = new EditorEventBus(onObserverError);
  }
  get events(): EditorEvents {
    return this.bus;
  }
  hasDocument(): boolean {
    return this.current !== undefined;
  }
  document(): ReadonlyDocument {
    if (!this.current) throw new DomainError("no document. use 'init' or 'read' first");
    return this.current;
  }
  init(width = 800, height = 600): string {
    this.current = new SvgDocument(width, height);
    this.currentPath = undefined;
    this.barrier();
    this.invocations.push(`init ${width} ${height}`);
    const message = `canvas ${width}x${height} created`;
    this.bus.publish({ type: 'documentInitialized', document: this.current });
    return message;
  }
  async read(path: string): Promise<readonly string[]> {
    this.current = new SvgDocument();
    this.currentPath = path;
    this.barrier();
    this.invocations.push(`read ${path}`);
    const warnings = [...this.readWarnings];
    const message = `read ${path} (${this.current.all().length} elements)`;
    this.bus.publish({ type: 'documentRead', document: this.current, path, warnings });
    return [...warnings, message];
  }
  async save(path?: string): Promise<string> {
    const document = this.requireDocument();
    const target = path ?? this.currentPath;
    if (!target) throw new DomainError('no file path. use save <file.svg>');
    this.currentPath ??= target;
    this.barrier();
    this.invocations.push(`save ${target}`);
    const message = `saved to ${target} (${document.all().length} elements)`;
    this.bus.publish({ type: 'documentSaved', document, path: target });
    return message;
  }
  canvas(width?: number, height?: number): string {
    const document = this.requireDocument();
    if ((width === undefined) !== (height === undefined))
      throw new DomainError('canvas requires both width and height');
    if (width !== undefined && height !== undefined) {
      const candidate = document.clone();
      candidate.resize(width, height);
      this.current = candidate;
      this.barrier();
      this.invocations.push(`canvas ${width} ${height}`);
      const message = `canvas ${width}x${height}`;
      this.bus.publish({
        type: 'canvasChanged',
        document: candidate,
        width,
        height,
        message,
      });
      return message;
    }
    this.invocations.push('canvas');
    return `canvas ${document.width}x${document.height}`;
  }
  edit(action: EditAction): string {
    const document = this.requireDocument();
    const candidate = document.clone();
    const message = action.apply(candidate);
    candidate.validate();
    this.current = candidate;
    this.undoStack.push({ before: document, after: candidate, message });
    this.redoStack.length = 0;
    this.blocked = false;
    this.invocations.push('edit');
    this.bus.publish({ type: 'editCommitted', document: candidate, message });
    return message;
  }
  undo(): string {
    this.requireDocument();
    this.check();
    const entry = this.undoStack.pop();
    if (!entry) throw new DomainError('nothing to undo');
    this.redoStack.push(entry);
    this.current = entry.before;
    this.invocations.push('undo');
    const message = `undone: ${entry.message}`;
    this.bus.publish({ type: 'undoCommitted', document: entry.before, message });
    return message;
  }
  redo(): string {
    this.requireDocument();
    this.check();
    const entry = this.redoStack.pop();
    if (!entry) throw new DomainError('nothing to redo');
    this.undoStack.push(entry);
    this.current = entry.after;
    this.invocations.push('redo');
    const message = `redone: ${entry.message}`;
    this.bus.publish({ type: 'redoCommitted', document: entry.after, message });
    return message;
  }
  private requireDocument(): SvgDocument {
    if (!this.current) throw new DomainError("no document. use 'init' or 'read' first");
    return this.current;
  }
  private barrier(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.blocked = true;
  }
  private check(): void {
    if (this.blocked) throw new DomainError('undo not allowed after io command');
  }
}
