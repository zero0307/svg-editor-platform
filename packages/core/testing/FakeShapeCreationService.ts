import { DomainError } from '../domain/DomainError.js';
import type { Shape } from '../domain/Shape.js';
import type { ShapeCreationRequest } from '../ports/ShapeCreationRequest.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';

/** Factory registered per domain type by `FakeShapeCreationService`. */
export type FakeShapeFactory = (request: ShapeCreationRequest) => Shape;

/**
 * Test double for `ShapeCreationService` that records requests and lets a test
 * register only the concrete shapes it needs (for example `rect` and `text` for a
 * box provider), without loading builtins.
 */
export class FakeShapeCreationService implements ShapeCreationService {
  private readonly factories = new Map<string, FakeShapeFactory>();
  readonly requests: ShapeCreationRequest[] = [];
  constructor(factories: Readonly<Record<string, FakeShapeFactory>> = {}) {
    for (const [type, factory] of Object.entries(factories)) this.factories.set(type, factory);
  }
  register(type: string, factory: FakeShapeFactory): void {
    if (this.factories.has(type)) throw new DomainError(`duplicate fake shape factory: ${type}`);
    this.factories.set(type, factory);
  }
  create(request: ShapeCreationRequest): Shape {
    this.requests.push(request);
    const factory = this.factories.get(request.type);
    if (!factory)
      throw new DomainError(`unknown shape type: ${request.type} (is the plugin loaded?)`);
    return factory(request);
  }
}
