import { DomainError } from '@svgframe/core';
import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
  ReadonlyShape,
} from '@svgframe/core';

/**
 * Test-only handler that mutates the candidate before failing. The framework must
 * discard the candidate, keep the live document/history unchanged and never fall
 * back to the default attribute path after a matched handler failure.
 */
export class FailingStampHandler implements AttributeHandler {
  readonly name = 'stamp-failing';
  handles(target: ReadonlyShape, attribute: string): boolean {
    return target.kind === 'stamp' && attribute === 'boom';
  }
  apply(context: AttributeEditContext, request: AttributeRequest): AttributeResult {
    context.document.require(`${request.targetId}-label`).setAttribute('text', 'partial');
    throw new DomainError(`stamp handler failed: ${this.name}`);
  }
}
