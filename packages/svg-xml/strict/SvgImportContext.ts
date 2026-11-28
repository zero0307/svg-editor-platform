import { DomainError, Numbers } from '@svgframe/core';
import { SvgTransform } from './SvgTransform.js';

/**
 * Keeps original inherited lengths separate from the normalized presentation tree.
 *
 * Ported from the Phase 1 importer: the accumulated world transform, inherited
 * `stroke-width`/`font-size` and the sensitivity of length attributes must stay
 * byte-compatible. The difference is that no shape is created here; the normalized
 * values are carried on `SvgElementView` and leaf providers apply the world
 * transform exactly once.
 */
export class SvgImportContext {
  private static readonly sensitive = new Set([
    'rx',
    'ry',
    'dx',
    'dy',
    'rotate',
    'textLength',
    'lengthAdjust',
    'stroke-dasharray',
    'stroke-dashoffset',
    'letter-spacing',
    'word-spacing',
    'kerning',
    'baseline-shift',
    'vector-effect',
  ]);
  private constructor(
    readonly transform: SvgTransform,
    private readonly localScale: number,
    private readonly strokeWidth: string,
    private readonly fontSize: string,
    private readonly sensitiveInherited: readonly string[],
    private readonly attributes: Readonly<Record<string, string>>,
  ) {}
  static root(): SvgImportContext {
    return new SvgImportContext(new SvgTransform(), 1, '1', '16', [], {});
  }
  child(attributes: Readonly<Record<string, string>>): SvgImportContext {
    const local = SvgTransform.parse(attributes.transform ?? '');
    const strokeWidth = attributes['stroke-width'];
    const fontSize = attributes['font-size'];
    return new SvgImportContext(
      this.transform.compose(local),
      local.scale,
      strokeWidth === undefined || SvgImportContext.inherits(strokeWidth)
        ? this.strokeWidth
        : strokeWidth,
      fontSize === undefined || SvgImportContext.inherits(fontSize) ? this.fontSize : fontSize,
      this.sensitiveInherited,
      attributes,
    );
  }
  normalizedAttributes(): Readonly<Record<string, string>> {
    const result = { ...this.attributes };
    delete result.transform;
    if (SvgImportContext.inherits(result['stroke-width']) && this.localScale === 1)
      delete result['stroke-width'];
    if (SvgImportContext.inherits(result['font-size']) && this.localScale === 1)
      delete result['font-size'];
    // A cancelling inner scale still has to reset values normalized by its parent.
    if (result['stroke-width'] !== undefined || this.localScale !== 1) {
      result['stroke-width'] = this.scaledLength(this.strokeWidth, 'stroke-width');
    }
    if (
      (result['font-size'] !== undefined && this.transform.scale !== 1) ||
      this.localScale !== 1
    ) {
      result['font-size'] = this.scaledLength(this.fontSize, 'font-size');
    }
    return result;
  }
  /**
   * Validate length-sensitive attributes at this level and return the context for
   * children. `geometry` lists the attribute names the element's provider will
   * scale itself, matching the Phase 1 `geometry()` keys.
   */
  apply(geometry: readonly string[]): SvgImportContext {
    const sensitive = [
      ...this.sensitiveInherited,
      ...Object.keys(this.attributes).filter(
        (name) => SvgImportContext.sensitive.has(name) && !geometry.includes(name),
      ),
    ];
    if (this.transform.scale !== 1 && sensitive.length)
      throw new DomainError(`unsupported scaled SVG attribute: ${sensitive[0]}`);
    return new SvgImportContext(
      this.transform,
      this.localScale,
      this.strokeWidth,
      this.fontSize,
      sensitive,
      this.attributes,
    );
  }
  private scaledLength(value: string, name: string): string {
    const numeric = Numbers.nonnegative(
      Numbers.parse(value.trim().replace(/px$/i, ''), name),
      name,
    );
    return Numbers.format(Numbers.finite(numeric * this.transform.scale, name));
  }
  private static inherits(value: string | undefined): boolean {
    return value?.trim().toLowerCase() === 'inherit';
  }
}
