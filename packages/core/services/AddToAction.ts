import { EditAction } from '../extensions/EditAction.js';
import type { SvgDocument } from '../domain/SvgDocument.js';
import type { StructureService } from './StructureService.js';

/** `addto <gid> <id>` as one candidate-document edit. */
export class AddToAction extends EditAction {
  constructor(
    private readonly structure: StructureService,
    private readonly containerId: string,
    private readonly id: string,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    return this.structure.moveTo(candidate, this.id, this.containerId);
  }
}
