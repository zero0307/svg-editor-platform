import { AttributeHandlerConflictError } from '../extensions/AttributeHandlerConflictError.js';
import type { AttributeHandlerRegistry } from '../extensions/AttributeHandlerRegistry.js';
import type { AttributeRequest } from '../extensions/AttributeHandler.js';
import type { EditableDocument } from '../domain/EditableDocument.js';

/**
 * Core attribute dispatch used by the `set` edit transaction.
 *
 * Resolution order is fixed before any mutation:
 * 1. collect handlers whose pure `handles` query matches, in registration order;
 * 2. two or more matches reject with `AttributeHandlerConflictError`;
 * 3. no match falls back to the target's default attribute rules;
 * 4. a single matched handler runs on the candidate document. Its failure
 *    propagates; the kernel never falls back to default handling afterwards.
 */
export class AttributeEditingService {
  constructor(private readonly handlers: AttributeHandlerRegistry) {}
  apply(candidate: EditableDocument, request: AttributeRequest): string {
    const target = candidate.require(request.targetId);
    const matching = this.handlers
      .entries()
      .filter((handler) => handler.handles(target, request.attribute));
    if (matching.length > 1)
      throw new AttributeHandlerConflictError(
        target.id,
        request.attribute,
        matching.map((handler) => handler.name),
      );
    if (matching.length === 0) {
      target.setAttribute(request.attribute, request.value);
      return AttributeEditingService.defaultMessage(target.kind, target.id, request);
    }
    const handler = matching[0]!;
    const result = handler.apply({ document: candidate }, request);
    return (
      result.message ?? AttributeEditingService.defaultMessage(target.kind, target.id, request)
    );
  }
  private static defaultMessage(kind: string, id: string, request: AttributeRequest): string {
    return `${kind}#${id} updated: ${request.attribute}=${JSON.stringify(request.value)}`;
  }
}
