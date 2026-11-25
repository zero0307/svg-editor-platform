import { Ellipse } from '../shapes/Ellipse.js';
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

const FIELDS = ['cx', 'cy', 'rx', 'ry'] as const;

export class EllipseProvider implements ShapeProvider {
  readonly type = 'ellipse';
  readonly defaultTag = 'ellipse';
  readonly usage = 'ellipse <id> <cx> <cy> <rx> <ry> [fill]';
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
    const shape = new Ellipse(
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
