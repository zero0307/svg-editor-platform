import { EditAction } from '../../index.js';
import type { ShapeCreationService, SvgDocument } from '../../index.js';

/** One composite creation as a detached-candidate edit action. */
export class DemoCreateAction extends EditAction {
  constructor(
    private readonly shapes: ShapeCreationService,
    private readonly id: string,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    candidate.ensureAvailable(this.id);
    const shape = this.shapes.create({ type: 'demo-box', id: this.id, parameters: [] });
    candidate.add(shape);
    return `${shape.tag}#${shape.id} created`;
  }
}
