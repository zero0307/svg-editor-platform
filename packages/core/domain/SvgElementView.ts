/** Source-independent transform data already normalized by the SVG entry point. */
export interface ElementTransform {
  /** Positive uniform scale. */
  readonly scale: number;
  readonly translateX: number;
  readonly translateY: number;
}

/**
 * Neutral SVG element view produced by `svg-xml` and consumed by providers.
 *
 * `attributes` are already normalized: `transform` is removed and inherited
 * `stroke-width`/`font-size` are resolved. `transform` is the accumulated world
 * transform of this element, so leaf providers apply it exactly once; a container
 * provider must not re-apply it to the restored subtree.
 */
export interface SvgElementView {
  readonly tag: string;
  readonly id: string | null;
  readonly attributes: Readonly<Record<string, string>>;
  readonly text: string | null;
  readonly children: readonly SvgElementView[];
  readonly transform: ElementTransform;
}
