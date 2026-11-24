import { DemoBoxShape } from './DemoBoxShape.js';
import type { Shape } from '../../index.js';
import type {
  ShapeCreationRequest,
  ShapeCreationService,
  ShapeProvider,
  ShapeRestoreService,
  SvgElementView,
} from '../../index.js';

/**
 * Consumer example: a composite provider that builds its parts only through the
 * public `ShapeCreationService` and restores a complete subtree through the
 * public `ShapeRestoreService`. It models what the box plugin will do without
 * importing builtins or XML code.
 */
export class DemoBoxProvider implements ShapeProvider {
  readonly type = 'demo-box';
  readonly usage = 'demo-box <id> [label]';
  create(request: ShapeCreationRequest, shapes: ShapeCreationService): Shape {
    const box = new DemoBoxShape(request.id);
    const label = request.parameters[0] ?? '';
    box.insert(
      shapes.create({
        type: 'rect',
        id: `${request.id}-rect`,
        parameters: ['0', '0', '100', '60'],
      }),
    );
    box.insert(
      shapes.create({
        type: 'text',
        id: `${request.id}-label`,
        parameters: ['0', '0', label],
      }),
    );
    return box;
  }
  matches(element: SvgElementView): boolean {
    return element.attributes['data-kind'] === this.type;
  }
  restore(element: SvgElementView, shapes: ShapeRestoreService): Shape {
    const box = new DemoBoxShape(element.id ?? 'demo-box');
    for (const child of element.children) box.insert(shapes.restore(child));
    return box;
  }
}
