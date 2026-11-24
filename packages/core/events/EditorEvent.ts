import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';

/**
 * Committed editor events. They are published only after the corresponding step
 * succeeded and carry the read-only document projection (plus the feedback that
 * was returned to the caller). Observers must not be able to break the already
 * committed document, history or dirty state.
 */
export interface DocumentInitializedEvent {
  readonly type: 'documentInitialized';
  readonly document: ReadonlyDocument;
}

export interface DocumentReadEvent {
  readonly type: 'documentRead';
  readonly document: ReadonlyDocument;
  readonly path: string;
  readonly warnings: readonly string[];
}

export interface DocumentSavedEvent {
  readonly type: 'documentSaved';
  readonly document: ReadonlyDocument;
  readonly path: string;
}

export interface EditCommittedEvent {
  readonly type: 'editCommitted';
  readonly document: ReadonlyDocument;
  readonly message: string;
}

export interface UndoCommittedEvent {
  readonly type: 'undoCommitted';
  readonly document: ReadonlyDocument;
  readonly message: string;
}

export interface RedoCommittedEvent {
  readonly type: 'redoCommitted';
  readonly document: ReadonlyDocument;
  readonly message: string;
}

export interface CanvasChangedEvent {
  readonly type: 'canvasChanged';
  readonly document: ReadonlyDocument;
  readonly width: number;
  readonly height: number;
  readonly message: string;
}

export type EditorEvent =
  | DocumentInitializedEvent
  | DocumentReadEvent
  | DocumentSavedEvent
  | EditCommittedEvent
  | UndoCommittedEvent
  | RedoCommittedEvent
  | CanvasChangedEvent;

export type EditorEventListener = (event: EditorEvent) => void;
