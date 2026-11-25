import type { OutlineSpan } from './OutlineSpan.js';

/**
 * Platform neutral outline node: the projection of one syntax element that the
 * model layer needs. It carries offsets only, never a `vscode` type, so the model
 * can be tested with `node:test`.
 */
export interface OutlineNode {
  /** Tag name exactly as written, including unknown tags and namespace prefixes. */
  readonly tag: string;
  /** Raw `id` attribute when the source has one; never synthesized. */
  readonly id?: string;
  readonly children: readonly OutlineNode[];
  /** Whole element: start tag through end tag, or the self-closing start tag. */
  readonly range: OutlineSpan;
  /** Start tag only, including `<`, attributes and `>`. */
  readonly startTag: OutlineSpan;
  /** Tag name inside the start tag. */
  readonly name: OutlineSpan;
}
