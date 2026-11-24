import type { EditorEventListener } from './EditorEvent.js';

/** Read-only subscription surface exposed to plugins and adapters. */
export interface EditorEvents {
  /** Returns an unsubscribe function; the subscription stays until it is called. */
  subscribe(listener: EditorEventListener): () => void;
}
