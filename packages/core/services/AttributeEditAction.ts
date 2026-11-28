import { EditAction } from '../extensions/EditAction.js';
import type { AttributeEditingService } from './AttributeEditingService.js';
import type { AttributeRequest } from '../extensions/AttributeHandler.js';
import type { SvgDocument } from '../domain/SvgDocument.js';

/**
 * A `set` request as one domain edit: handlers may modify several sub-shapes, but
 * the whole call is a single undo unit because it runs on one candidate document.
 */
export class AttributeEditAction extends EditAction {
  constructor(
    private readonly service: AttributeEditingService,
    private readonly request: AttributeRequest,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    return this.service.apply(candidate, this.request);
  }
}
