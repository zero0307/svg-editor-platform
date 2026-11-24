import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';
import type { SvgDocument } from '../domain/SvgDocument.js';

/**
 * Public SVG codec port. `decode` returns a fully restored document plus import
 * warnings; `encode` serializes the current document. Both operations may throw a
 * `DomainError`; the session keeps the previous state in that case.
 */
export interface SvgCodec {
  decode(source: string): { document: SvgDocument; warnings: readonly string[] };
  encode(document: ReadonlyDocument): string;
}
