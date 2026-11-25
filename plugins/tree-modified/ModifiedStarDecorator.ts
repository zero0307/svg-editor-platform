import { contentSnapshot, dirtyIds } from './ContentSnapshot.js';
import type { ContentSnapshot } from './ContentSnapshot.js';
import type { EditorEvent, ReadonlyDocument, TreeDecorator, TreeRow } from '@svgframe/core';

/**
 * `modified-star` content dirty label.
 *
 * The baseline is the content projection of the last successful `init`, `read` or
 * `save`, so a fresh empty document starts clean, saving clears stars and
 * `undo`/`redo` can return to the saved bytes without any special casing. Editing
 * events do not change the baseline; a failed edit/save publishes no event and
 * therefore cannot move it either.
 *
 * All state lives on the instance: no module-level variable, no XML string
 * fingerprint, no reading of other decorators. Each rendered row asks the same
 * cached dirty set, computed from the read-only document projection, and returns
 * only its own `*` suffix (or `null`), so the framework can keep the box label
 * ordering and the zero-decorator bytes.
 */
export class ModifiedStarDecorator implements TreeDecorator {
  readonly name = 'modified-star';
  private baseline: ContentSnapshot | null = null;
  /** Bumped whenever the baseline changes so a same-object document cache misses. */
  private baselineVersion = 0;
  private cache:
    | {
        readonly document: ReadonlyDocument;
        readonly version: number;
        readonly dirty: ReadonlySet<string>;
      }
    | undefined;

  /**
   * Committed events are consumed only through the public listener contract. Only
   * document lifecycle events replace the baseline; edit/undo/redo/canvas events
   * just leave the current document to be compared on the next render.
   */
  onEvent(event: EditorEvent): void {
    if (
      event.type !== 'documentInitialized' &&
      event.type !== 'documentRead' &&
      event.type !== 'documentSaved'
    )
      return;
    this.baseline = contentSnapshot(event.document);
    this.baselineVersion++;
    this.cache = undefined;
  }

  decorate(row: TreeRow): string | null {
    return this.dirtySet(row.document).has(row.node.id) ? '*' : null;
  }

  private dirtySet(document: ReadonlyDocument): ReadonlySet<string> {
    // A decorator used without lifecycle events starts from the first render as baseline.
    this.baseline ??= contentSnapshot(document);
    if (this.cache?.document === document && this.cache.version === this.baselineVersion)
      return this.cache.dirty;
    const dirty = dirtyIds(document, this.baseline);
    this.cache = { document, version: this.baselineVersion, dirty };
    return dirty;
  }
}
