import { Line } from '../shapes/Line.js';
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

const FIELDS = ['x1', 'y1', 'x2', 'y2'] as const;

export class LineProvider implements ShapeProvider {
  readonly type = 'line';
  readonly defaultTag = 'line';
  readonly usage = 'line <id> <x1> <y1> <x2> <y2> [stroke]';
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
    const shape = new Line(
      id,
      numberParameter(this.type, parameters, 0),
      numberParameter(this.type, parameters, 1),
      numberParameter(this.type, parameters, 2),
      numberParameter(this.type, parameters, 3),
    );
    if (parameters.length === 5) shape.setAttribute('stroke', parameter(this.type, parameters, 4));
    return shape;
  }
}
