import { EditAction } from '../extensions/EditAction.js';
import type { SvgDocument } from '../domain/SvgDocument.js';
import type { StructureService } from './StructureService.js';

/** `ungroup <gid>` as one candidate-document edit. */
export class UngroupAction extends EditAction {
  constructor(
    private readonly structure: StructureService,
    private readonly id: string,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    return this.structure.ungroup(candidate, this.id);
  }
}
