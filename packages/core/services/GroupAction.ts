import { EditAction } from '../extensions/EditAction.js';
import type { SvgDocument } from '../domain/SvgDocument.js';
import type { StructureService } from './StructureService.js';

/** `group <newGid> <id1> <id2>...` as one candidate-document edit. */
export class GroupAction extends EditAction {
  constructor(
    private readonly structure: StructureService,
    private readonly id: string,
    private readonly ids: readonly string[],
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    return this.structure.group(candidate, this.id, this.ids);
  }
}
