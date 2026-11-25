import type { OutlineSymbol } from './OutlineSymbol.js';
import type { OutlineParseResult } from './OutlineParseResult.js';
import { SvgOutlineModel } from './SvgOutlineModel.js';
import { SvgSyntaxOutlineMapper } from './SvgSyntaxOutlineMapper.js';

/** Outline recomputed from one document text, plus a diagnostic when unreadable. */
export interface OutlineReading {
  readonly symbols: readonly OutlineSymbol[];
  /** Present only when the syntax layer rejected the document. */
  readonly warning?: string;
}

/**
 * Reads SVG source into outline symbols.
 *
 * Every call parses again, so the host sees the outline refresh on each edit; no
 * cache is kept. Incomplete XML produces an empty outline plus a warning instead
 * of throwing, which keeps the editor usable while the user is typing.
 */
export class SvgOutlineReader {
  private readonly model: SvgOutlineModel;

  constructor(
    private readonly mapper: SvgSyntaxOutlineMapper = new SvgSyntaxOutlineMapper(),
    model: SvgOutlineModel = new SvgOutlineModel(),
  ) {
    this.model = model;
  }

  read(source: string): OutlineReading {
    const parsed: OutlineParseResult = this.mapper.parse(source);
    if (!parsed.ok) return { symbols: [], warning: `SVG outline unavailable: ${parsed.message}` };
    return { symbols: this.model.build(parsed.root) };
  }
}
