import { DomainError } from '@svgframe/core';
import { BoxShape } from './BoxShape.js';
import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
  ReadonlyShape,
} from '@svgframe/core';

/**
 * Domain attribute semantics for boxes: `fill` is propagated to the necessary
 * rectangle and the plugin-only convenience attribute `label` rewrites the
 * necessary text. Both run on the candidate document, so one `set` remains a single
 * undo unit even though a part is modified. `handles` is a pure query and only
 * claims boxes: a `label` on any other shape keeps falling through to the Phase 1
 * attribute whitelist and therefore reports `unknown attribute: label`.
 */
export class BoxAttributeHandler implements AttributeHandler {
  readonly name = 'box-attributes';

  handles(target: ReadonlyShape, attribute: string): boolean {
    return target instanceof BoxShape && (attribute === 'fill' || attribute === 'label');
  }

  apply(context: AttributeEditContext, request: AttributeRequest): AttributeResult {
    const box = context.document.require(request.targetId);
    if (!(box instanceof BoxShape)) throw new DomainError(`not a box: ${request.targetId}`);
    if (request.attribute === 'fill') {
      const rect = box.rect();
      rect.setAttribute('fill', request.value);
      return { message: `box#${box.id} fill propagated to ${rect.id}` };
    }
    if (request.attribute === 'label') {
      const label = box.label();
      label.setAttribute('text', request.value);
      return { message: `box#${box.id} label updated: ${JSON.stringify(request.value)}` };
    }
    throw new DomainError(`unknown attribute: ${request.attribute}`);
  }
}
