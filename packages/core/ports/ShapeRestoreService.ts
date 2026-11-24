import type { Shape } from '../domain/Shape.js';
import type { SvgElementView } from '../domain/SvgElementView.js';

/**
 * Restores one element of a fully pre-processed SVG view through the registered
 * providers. A container provider uses this to restore its children with the same
 * provider selection rules; the transform on each child is applied exactly once
 * by the leaf provider.
 */
export interface ShapeRestoreService {
  restore(element: SvgElementView): Shape;
}
