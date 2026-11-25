import { DomainError } from '@svgframe/core';
import { StampShape } from './StampShape.js';
import type {
  Shape,
  ShapeCreationRequest,
  ShapeCreationService,
  ShapeProvider,
  ShapeRestoreService,
  SvgElementView,
} from '@svgframe/core';

/**
 * Composite provider for the test-only `stamp` type. It is selected by the
 * `data-kind="stamp"` marker (never by tag) and builds its two role parts through
 * the public creation service, so the test does not need builtins or any plugin.
 */
export class StampProvider implements ShapeProvider {
  readonly type = 'stamp';
  readonly usage = 'stamp <id> [caption]';
  matches(element: SvgElementView): boolean {
    return element.tag === 'g' && element.attributes['data-kind'] === 'stamp';
  }
  create(request: ShapeCreationRequest, shapes: ShapeCreationService): Shape {
    if (request.parameters.length > 1) throw new DomainError(`invalid parameters for ${this.type}`);
    const stamp = new StampShape(request.id);
    stamp.insert(shapes.create({ type: 'stamp-frame', id: stamp.partId('frame'), parameters: [] }));
    stamp.insert(
      shapes.create({
        type: 'stamp-label',
        id: stamp.partId('label'),
        parameters: [request.parameters[0] ?? ''],
      }),
    );
    stamp.preserveAttribute('data-kind', 'stamp');
    return stamp;
  }
  restore(element: SvgElementView, shapes: ShapeRestoreService): Shape {
    const stamp = new StampShape(element.id ?? '');
    for (const child of element.children) stamp.insert(shapes.restore(child));
    const marker = element.attributes['data-kind'];
    if (marker !== undefined) stamp.preserveAttribute('data-kind', marker);
    return stamp;
  }
}
