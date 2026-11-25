import { Circle } from '../shapes/Circle.js';
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

const FIELDS = ['cx', 'cy', 'r'] as const;

export class CircleProvider implements ShapeProvider {
  readonly type = 'circle';
  readonly defaultTag = 'circle';
  readonly usage = 'circle <id> <cx> <cy> <r> [fill]';
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
    requireParameterCount(this.type, parameters, 3, 4);
    const shape = new Circle(
      id,
      numberParameter(this.type, parameters, 0),
      numberParameter(this.type, parameters, 1),
      numberParameter(this.type, parameters, 2),
    );
    if (parameters.length === 4) shape.setAttribute('fill', parameter(this.type, parameters, 3));
    return shape;
  }
}
