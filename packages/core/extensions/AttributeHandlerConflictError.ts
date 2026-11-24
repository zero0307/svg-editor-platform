import { DomainError } from '../domain/DomainError.js';

/**
 * Two or more registered attribute handlers claim the same request. Raised before
 * any mutation so the candidate document, history and dirty baseline stay intact.
 */
export class AttributeHandlerConflictError extends DomainError {
  readonly targetId: string;
  readonly attribute: string;
  readonly handlers: readonly string[];
  constructor(targetId: string, attribute: string, handlers: readonly string[]) {
    super(`ambiguous attribute handlers for ${targetId}.${attribute}: ${handlers.join(', ')}`);
    this.name = 'AttributeHandlerConflictError';
    this.targetId = targetId;
    this.attribute = attribute;
    this.handlers = [...handlers];
  }
}
