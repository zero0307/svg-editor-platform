import { Rect } from '../shapes/Rect.js';
import {
  applyElementTransform,
  applyRestoredAttributes,
  geometryParameters,
  numberParameter,
  parameter,
  requireParameterCount,
  restoredId,
} from './ProviderSupport.js';
import type {
  Shape,
  ShapeCreationRequest,
  ShapeCreationService,
  ShapeProvider,
  ShapeRestoreService,
  SvgElementView,
} from '@svgframe/core';

const FIELDS = ['x', 'y', 'width', 'height'] as const;

export class RectProvider implements ShapeProvider {
  readonly type = 'rect';
  readonly defaultTag = 'rect';
  readonly usage = 'rect <id> <x> <y> <w> <h> [fill]';
  create(request: ShapeCreationRequest, _shapes: ShapeCreationService): Shape {
    return this.construct(request.id, request.parameters);
  }
  matches(_element: SvgElementView): boolean {
    return false;
  }
  restore(element: SvgElementView, _shapes: ShapeRestoreService): Shape {
    const shape = this.construct(restoredId(element), geometryParameters(element, FIELDS));
    applyRestoredAttributes(shape, element, FIELDS);
    applyElementTransform(shape, element);
    return shape;
  }
  private construct(id: string, parameters: readonly string[]): Shape {
    requireParameterCount(this.type, parameters, 4, 5);
    const shape = new Rect(
      id,
      numberParameter(this.type, parameters, 0),
      numberParameter(this.type, parameters, 1),
      numberParameter(this.type, parameters, 2),
      numberParameter(this.type, parameters, 3),
    );
    if (parameters.length === 5) shape.setAttribute('fill', parameter(this.type, parameters, 4));
    return shape;
  }
}
