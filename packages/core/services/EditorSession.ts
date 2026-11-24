import { DomainError } from '../domain/DomainError.js';
import { EditorEventBus } from '../events/EditorEventBus.js';
import { EditHistory } from './EditHistory.js';
import { SvgDocument } from '../domain/SvgDocument.js';
import type { EditAction } from '../extensions/EditAction.js';
import type { EditorEvent } from '../events/EditorEvent.js';
import type { EditorEvents } from '../events/EditorEvents.js';
import type { EditorSessionPort } from '../ports/EditorSessionPort.js';
import type { FileStore } from '../ports/FileStore.js';
import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';
import type { SvgCodec } from '../ports/SvgCodec.js';

/**
 * Candidate-document editing session.
 *
 * Every edit runs on a detached polymorphic clone, validates the whole tree and
 * only then replaces the current document and appends one undo unit. Any failure
 * discards the candidate: document, remembered path, barrier and undo/redo stacks
 * stay untouched and no committed event is published. I/O follows the Phase 1
 * barrier rules: `init`/`read`/`save` and `canvas` resize set the barrier; a
 * successful edit clears it.
 *
 * Undo/redo swap validated snapshots; they never re-apply handlers or re-encode
 * the document.
 */
export class EditorSession implements EditorSessionPort {
  private current: SvgDocument | undefined;
  private currentPath: string | undefined;
  private readonly history = new EditHistory();
  private readonly bus: EditorEventBus;
  constructor(
    private readonly files: FileStore,
    private readonly codec: SvgCodec,
    onObserverError?: (error: unknown, event: EditorEvent) => void,
  ) {
    this.bus = new EditorEventBus(onObserverError);
  }
  get events(): EditorEvents {
    return this.bus;
  }
  hasDocument(): boolean {
    return this.current !== undefined;
  }
  document(): ReadonlyDocument {
    return this.requireDocument();
  }
  init(width = 800, height = 600): string {
    const candidate = new SvgDocument(width, height);
    this.current = candidate;
    this.currentPath = undefined;
    this.history.barrier();
    const message = `canvas ${width}x${height} created`;
    this.bus.publish({ type: 'documentInitialized', document: candidate });
    return message;
  }
  async read(path: string): Promise<readonly string[]> {
    const source = await this.files.read(path);
    const decoded = this.codec.decode(source);
    decoded.document.validate();
    this.current = decoded.document;
    this.currentPath = path;
    this.history.barrier();
    const warnings = [...decoded.warnings];
    const message = `read ${path} (${decoded.document.all().length} elements)`;
    this.bus.publish({
      type: 'documentRead',
      document: decoded.document,
      path,
      warnings,
    });
    return [...warnings, message];
  }
  async save(path?: string): Promise<string> {
    const document = this.requireDocument();
    const target = path ?? this.currentPath;
    if (!target) throw new DomainError('no file path. use save <file.svg>');
    const source = this.codec.encode(document);
    await this.files.write(target, source);
    this.currentPath ??= target;
    this.history.barrier();
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
      this.history.barrier();
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
    return `canvas ${document.width}x${document.height}`;
  }
  edit(action: EditAction): string {
    const document = this.requireDocument();
    const candidate = document.clone();
    const message = action.apply(candidate);
    candidate.validate();
    this.current = candidate;
    this.history.record({ before: document, after: candidate, message });
    this.bus.publish({ type: 'editCommitted', document: candidate, message });
    return message;
  }
  undo(): string {
    this.requireDocument();
    const entry = this.history.undo();
    this.current = entry.before;
    const message = `undone: ${entry.message}`;
    this.bus.publish({ type: 'undoCommitted', document: entry.before, message });
    return message;
  }
  redo(): string {
    this.requireDocument();
    const entry = this.history.redo();
    this.current = entry.after;
    const message = `redone: ${entry.message}`;
    this.bus.publish({ type: 'redoCommitted', document: entry.after, message });
    return message;
  }
  private requireDocument(): SvgDocument {
    if (!this.current) throw new DomainError("no document. use 'init' or 'read' first");
    return this.current;
  }
}
