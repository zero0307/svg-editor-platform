import { DomainError } from '../domain/DomainError.js';
import { SvgDocument } from '../domain/SvgDocument.js';
import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';
import type { SvgCodec } from '../ports/SvgCodec.js';

/** Options of the deterministic in-memory codec used by session tests. */
export interface FakeSvgCodecOptions {
  readonly documentFactory?: (source: string) => SvgDocument;
  readonly warnings?: readonly string[];
  readonly decodeFailure?: string;
  readonly encodeFailure?: string;
}

/**
 * Test double for the SVG codec port. It performs no XML parsing: `decode`
 * builds a document through the supplied factory, `encode` returns a stable
 * fingerprint. Failure messages let tests exercise the session rollback paths.
 */
export class FakeSvgCodec implements SvgCodec {
  private readonly options: FakeSvgCodecOptions;
  constructor(options: FakeSvgCodecOptions = {}) {
    this.options = options;
  }
  decode(source: string): { document: SvgDocument; warnings: readonly string[] } {
    if (this.options.decodeFailure) throw new DomainError(this.options.decodeFailure);
    const document = this.options.documentFactory
      ? this.options.documentFactory(source)
      : new SvgDocument();
    return { document, warnings: [...(this.options.warnings ?? [])] };
  }
  encode(document: ReadonlyDocument): string {
    if (this.options.encodeFailure) throw new DomainError(this.options.encodeFailure);
    return `encoded ${document.width}x${document.height} (${document.all().length} elements)`;
  }
}
