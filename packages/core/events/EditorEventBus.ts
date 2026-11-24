import type { EditorEvent, EditorEventListener } from './EditorEvent.js';
import type { EditorEvents } from './EditorEvents.js';

/**
 * Minimal editor event bus with observer isolation.
 *
 * Publishing never throws because of an observer: a failing listener is reported
 * to `onObserverError` and the remaining listeners still receive the event. The
 * session publishes only after a successful commit, so a broken observer cannot
 * undo a completed document change.
 */
export class EditorEventBus implements EditorEvents {
  private readonly listeners: EditorEventListener[] = [];
  private readonly onObserverError: (error: unknown, event: EditorEvent) => void;
  constructor(onObserverError?: (error: unknown, event: EditorEvent) => void) {
    this.onObserverError = onObserverError ?? (() => {});
  }
  subscribe(listener: EditorEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }
  get observerCount(): number {
    return this.listeners.length;
  }
  publish(event: EditorEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        this.onObserverError(error, event);
      }
    }
  }
}
