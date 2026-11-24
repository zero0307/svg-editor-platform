import type { SvgSyntaxSpan } from './SvgSyntaxSpan.js';

/**
 * One element of the neutral SVG syntax tree.
 *
 * The syntax layer keeps every tag exactly as written, including unknown SVG
 * tags, duplicate tag names and elements without an id. It never assigns ids,
 * applies the CLI whitelist or creates editable domain objects.
 */
export interface SvgSyntaxElement {
  /** Qualified tag name as written in the source, for example `svg`, `g` or `ns:rect`. */
  readonly tag: string;
  /** Raw `id` attribute value when present. Missing ids are observed as `undefined`. */
  readonly id?: string;
  /** Direct character data of this element, children excluded; raw and not trimmed. */
  readonly text: string;
  readonly children: readonly SvgSyntaxElement[];
  /** Whole element: start tag through end tag, or a self-closing start tag. */
  readonly outerSpan: SvgSyntaxSpan;
  /** Start tag only: from `<` through the closing `>` (including `/>`). */
  readonly startTagSpan: SvgSyntaxSpan;
  /** The tag name inside the start tag; suitable for VSCode `selectionRange`. */
  readonly nameSpan: SvgSyntaxSpan;
}
