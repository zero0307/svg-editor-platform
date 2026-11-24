import { DomainError } from '../../index.js';
import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
  ReadonlyShape,
} from '../../index.js';

/**
 * Faulty handler that already changed one sub-part before throwing. The session
 * must discard the whole candidate and keep the previous document and history.
 */
export class PartialFaultyAttributeHandler implements AttributeHandler {
  readonly name = 'partial-faulty';
  handles(target: ReadonlyShape, attribute: string): boolean {
    return target.kind === 'demo-box' && attribute === 'fill';
  }
  apply(context: AttributeEditContext, request: AttributeRequest): AttributeResult {
    const rect = context.document.require(`${request.targetId}-rect`);
    rect.setAttribute('fill', 'mutated');
    throw new DomainError('handler failed after partial modification');
  }
}
