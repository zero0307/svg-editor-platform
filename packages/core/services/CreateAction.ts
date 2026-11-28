import { EditAction } from '../extensions/EditAction.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';
import type { SvgDocument } from '../domain/SvgDocument.js';

/**
 * Generic `create` edit: checks global id availability, resolves the optional
 * target container and delegates shape construction to the public creation
 * service. Derived ids created by composite providers are part of the same
 * candidate-document edit and therefore of the same undo unit.
 */
export class CreateAction extends EditAction {
  constructor(
    private readonly shapes: ShapeCreationService,
    private readonly type: string,
    private readonly id: string,
    private readonly parameters: readonly string[],
    private readonly containerId?: string,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    candidate.ensureAvailable(this.id);
    const parent =
      this.containerId === undefined ? candidate.root : candidate.container(this.containerId);
    const shape = this.shapes.create({ type: this.type, id: this.id, parameters: this.parameters });
    candidate.add(shape, parent);
    return `${shape.tag}#${shape.id} created${
      this.containerId === undefined ? '' : ` in ${parent.tag}#${this.containerId}`
    }`;
  }
}
