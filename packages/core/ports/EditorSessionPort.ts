import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';
import type { EditAction } from '../extensions/EditAction.js';
import type { EditorEvents } from '../events/EditorEvents.js';

/**
 * Public editing-session port used by CLI, adapters and the DSH integration.
 *
 * Names and behavior follow Phase 1 `SvgEditor`: `document`, `init`, `read`,
 * `save`, `canvas`, `edit`, `undo`, `redo`. `document()` returns the read-only
 * projection; mutations only happen through an `EditAction` or a document
 * operation. The real implementation (transaction, barriers, events) is part of
 * the framework task; this contract fixes the signatures consumers compile against.
 */
export interface EditorSessionPort {
  /** Read-only event subscription; events are published only after a successful step. */
  readonly events: EditorEvents;
  hasDocument(): boolean;
  document(): ReadonlyDocument;
  init(width?: number, height?: number): string;
  read(path: string): Promise<readonly string[]>;
  save(path?: string): Promise<string>;
  /** Without size arguments this is a read-only query; with size it resizes and sets the I/O barrier. */
  canvas(width?: number, height?: number): string;
  edit(action: EditAction): string;
  undo(): string;
  redo(): string;
}
