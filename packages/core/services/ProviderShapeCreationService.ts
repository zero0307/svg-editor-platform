import type { ShapeProviderRegistry } from '../extensions/ShapeProviderRegistry.js';
import type { Shape } from '../domain/Shape.js';
import type { ShapeCreationRequest } from '../ports/ShapeCreationRequest.js';
import type { ShapeCreationService } from '../ports/ShapeCreationService.js';

/**
 * Default shape creation service backed by the live provider registry.
 *
 * `create` dispatches by the provider's stable type name; composite providers
 * receive this same service so their derived parts go through the public entry.
 * It never knows concrete builtins names.
 */
export class ProviderShapeCreationService implements ShapeCreationService {
  constructor(private readonly providers: ShapeProviderRegistry) {}
  create(request: ShapeCreationRequest): Shape {
    return this.providers.require(request.type).create(request, this);
  }
}
