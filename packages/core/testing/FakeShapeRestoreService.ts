import type { Shape } from '../domain/Shape.js';
import type { SvgElementView } from '../domain/SvgElementView.js';
import type { ShapeRestoreService } from '../ports/ShapeRestoreService.js';

/**
 * Test double for `ShapeRestoreService`: delegates to a supplied recipe and
 * records the views it was asked to restore, so provider-driven restore can be
 * verified without a real SVG codec.
 */
export class FakeShapeRestoreService implements ShapeRestoreService {
  readonly restored: SvgElementView[] = [];
  constructor(private readonly recipe: (element: SvgElementView) => Shape) {}
  restore(element: SvgElementView): Shape {
    this.restored.push(element);
    return this.recipe(element);
  }
}
