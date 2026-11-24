import type { Shape } from '../domain/Shape.js';
import type { ShapeCreationRequest } from './ShapeCreationRequest.js';

/**
 * Public shape creation port. Composite plugins (box) build their derived parts
 * through this service instead of importing concrete shapes from builtins.
 */
export interface ShapeCreationService {
  create(request: ShapeCreationRequest): Shape;
}
