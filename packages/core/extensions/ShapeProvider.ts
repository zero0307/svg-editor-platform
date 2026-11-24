import type { SvgElementView } from '../domain/SvgElementView.js';
import type { Shape } from '../domain/Shape.js';
import type { ShapeCreationRequest } from '../ports/ShapeCreationRequest.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';
import type { ShapeRestoreService } from '../ports/ShapeRestoreService.js';

/**
 * Creates and restores one domain shape type. Registered under the stable domain
 * type name (`rect`, `box`, ...); `create` owns its parameter rules and `restore`
 * owns the SVG-to-domain mapping for a complete subtree.
 */
export interface ShapeProvider {
  /** Stable registration name and domain `kind`, for example `rect` or `box`. */
  readonly type: string;
  /** Parameter help line used by `help`, for example `rect <id> <x> ...`. */
  readonly usage?: string;
  /**
   * SVG tag this provider restores when no provider claims the element through
   * `matches`. Omit for providers that are only selected by an explicit marker.
   */
  readonly defaultTag?: string;
  create(request: ShapeCreationRequest, shapes: ShapeCreationService): Shape;
  /**
   * Pure query: does this provider explicitly claim the element by its metadata?
   * Default (tag-based) providers return `false`; the codec falls back to
   * `defaultTag`. Ambiguous explicit matches must be rejected by the caller.
   */
  matches(element: SvgElementView): boolean;
  restore(element: SvgElementView, shapes: ShapeRestoreService): Shape;
}
