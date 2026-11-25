import { DomainError, Numbers } from '@svgframe/core';
import { BoxShape } from './BoxShape.js';
import type {
  Shape,
  ShapeCreationRequest,
  ShapeCreationService,
  ShapeProvider,
  ShapeRestoreService,
  SvgElementView,
} from '@svgframe/core';

/** Role template fixed by Phase 1 §6.1B: rect at (x,y,w,h), label at (x+20, y+h/2+5). */
const DEFAULT_FILL = '#4a90d9';
const LABEL_OFFSET_X = 20;
const LABEL_BASELINE_OFFSET = 5;

/**
 * Provider for the `box` composite type.
 *
 * `create` owns the Phase 1 parameter grammar and builds both role parts through
 * the public `ShapeCreationService`, so the plugin never imports a concrete
 * `Rect`/`Text` class. The parts belong to the same candidate-document edit as the
 * container: a derived-id conflict or any part failure aborts the whole command and
 * leaves no residue. `matches` claims only the explicit `g` + `data-kind="box"`
 * marker; without this provider the codec falls back to the ordinary `g` provider
 * and keeps the marker as imported metadata. `restore` rebuilds a complete subtree
 * (children restored with their own world transforms and never re-transformed by
 * the container) and rejects incomplete/wrongly typed boxes so a single read fails
 * atomically instead of producing a partial domain object.
 */
export class BoxProvider implements ShapeProvider {
  readonly type = 'box';
  readonly usage = 'box <id> <x> <y> <w> <h> "label"';

  matches(element: SvgElementView): boolean {
    return element.tag === 'g' && element.attributes['data-kind'] === 'box';
  }

  create(request: ShapeCreationRequest, shapes: ShapeCreationService): Shape {
    if (request.parameters.length !== 5)
      throw new DomainError(`invalid parameters for ${this.type}`);
    const x = this.number(request, 0);
    const y = this.number(request, 1);
    const width = this.number(request, 2);
    const height = this.number(request, 3);
    const label = request.parameters[4]!;
    const box = new BoxShape(request.id);
    box.insert(
      shapes.create({
        type: 'rect',
        id: box.rectId(),
        parameters: [
          Numbers.format(x),
          Numbers.format(y),
          Numbers.format(width),
          Numbers.format(height),
          DEFAULT_FILL,
        ],
      }),
    );
    box.insert(
      shapes.create({
        type: 'text',
        id: box.labelId(),
        parameters: [
          Numbers.format(x + LABEL_OFFSET_X),
          Numbers.format(y + height / 2 + LABEL_BASELINE_OFFSET),
          label,
        ],
      }),
    );
    return box;
  }

  restore(element: SvgElementView, shapes: ShapeRestoreService): Shape {
    if (!element.id) throw new DomainError('invalid box structure: missing id');
    const box = new BoxShape(element.id);
    this.applyAttributes(box, element);
    for (const child of element.children) box.insert(shapes.restore(child));
    box.validateInvariant();
    return box;
  }

  private number(request: ShapeCreationRequest, index: number): number {
    return Numbers.parse(request.parameters[index]!, `parameter ${index + 1}`);
  }

  /**
   * Applies already-normalized element attributes in Phase 1 order: presentation
   * goes through the validated setters, everything else (including the domain
   * marker and custom metadata) is preserved. The container never re-applies
   * `element.transform`; children carry their own accumulated world transform.
   */
  private applyAttributes(box: BoxShape, element: SvgElementView): void {
    for (const [name, value] of Object.entries(element.attributes)) {
      if (name === 'id' || name.startsWith('xmlns')) continue;
      if (name === 'fill' || name === 'stroke' || name === 'stroke-width')
        box.setAttribute(name, value);
      else box.preserveAttribute(name, value);
    }
  }
}
