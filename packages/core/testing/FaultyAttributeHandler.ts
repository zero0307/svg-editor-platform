import { DomainError } from '../domain/DomainError.js';
import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
} from '../extensions/AttributeHandler.js';
import type { ReadonlyShape } from '../domain/ReadonlyShape.js';

/**
 * Test double that claims every attribute and fails deterministically, either in
 * the pure `handles` query or during `apply`. Used to verify the contract that a
 * handler failure propagates and never falls back to default attribute handling.
 */
export class FaultyAttributeHandler implements AttributeHandler {
  constructor(
    readonly name = 'faulty-attributes',
    private readonly failure: 'handles' | 'apply' = 'apply',
  ) {}
  handles(_target: ReadonlyShape, _attribute: string): boolean {
    if (this.failure === 'handles') throw new DomainError(`attribute handler failed: ${this.name}`);
    return true;
  }
  apply(_context: AttributeEditContext, _request: AttributeRequest): AttributeResult {
    throw new DomainError(`attribute handler failed: ${this.name}`);
  }
}
