import type { OutlineSpan } from './OutlineSpan.js';

/**
 * One symbol of the native Outline, still in neutral offsets.
 *
 * `name` is `tag#id` when the source has an id and `tag` otherwise; the model
 * never invents ids. `range` covers the whole element and `selectionRange` stays
 * inside it so the host can reveal/select the start tag when the symbol is
 * clicked.
 */
export interface OutlineSymbol {
  readonly name: string;
  readonly tag: string;
  /** True when the element has element children (root and containers). */
  readonly container: boolean;
  readonly range: OutlineSpan;
  readonly selectionRange: OutlineSpan;
  readonly children: readonly OutlineSymbol[];
}
