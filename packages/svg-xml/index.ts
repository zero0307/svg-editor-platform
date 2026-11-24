import { SvgSyntaxParser } from './syntax/SvgSyntaxParser.js';
import type { SvgSyntaxResult } from './syntax/SvgSyntaxResult.js';

export type { SvgSyntaxElement } from './syntax/SvgSyntaxElement.js';
export type { SvgSyntaxResult } from './syntax/SvgSyntaxResult.js';
export type { SvgSyntaxSpan } from './syntax/SvgSyntaxSpan.js';

/**
 * Parse SVG (or any XML) into the neutral syntax tree used by the VSCode
 * Outline. It keeps unknown tags, duplicate tags and missing ids, never assigns
 * ids, and reports malformed or incomplete input as `ok: false` without throwing.
 *
 * Span offsets are 0-based UTF-16 code unit indices with an exclusive end; see
 * `SvgSyntaxSpan`.
 */
export function parseSvgSyntax(source: string): SvgSyntaxResult {
  return new SvgSyntaxParser(source).parse();
}
