import { parseSvgSyntax } from '@svgframe/svg-xml';
import type { SvgSyntaxElement } from '@svgframe/svg-xml';
import type { OutlineNode } from './OutlineNode.js';
import type { OutlineParseResult } from './OutlineParseResult.js';

/**
 * The only file of this extension that imports `@svgframe/svg-xml`.
 *
 * It converts the neutral syntax tree into the offsets-only node consumed by
 * `SvgOutlineModel`. Spans are taken verbatim from the syntax layer (0-based
 * UTF-16 code units, exclusive end); the mapper never searches tag text and never
 * assigns ids. A different syntax API would only change this file.
 */
export class SvgSyntaxOutlineMapper {
  parse(source: string): OutlineParseResult {
    const result = parseSvgSyntax(source);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, root: this.toNode(result.root) };
  }

  toNode(element: SvgSyntaxElement): OutlineNode {
    return {
      tag: element.tag,
      id: element.id,
      children: element.children.map((child) => this.toNode(child)),
      range: { start: element.outerSpan.start, end: element.outerSpan.end },
      startTag: { start: element.startTagSpan.start, end: element.startTagSpan.end },
      name: { start: element.nameSpan.start, end: element.nameSpan.end },
    };
  }
}
