import { Text } from '../shapes/Text.js';
import {
  applyElementTransform,
  applyRestoredAttributes,
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

const FIELDS = ['x', 'y'] as const;

export class TextProvider implements ShapeProvider {
  readonly type = 'text';
  readonly defaultTag = 'text';
  readonly usage = 'text <id> <x> <y> "content"';
  create(request: ShapeCreationRequest, _shapes: ShapeCreationService): Shape {
    return this.construct(request.id, request.parameters);
  }
  matches(_element: SvgElementView): boolean {
    return false;
  }
  restore(element: SvgElementView, _shapes: ShapeRestoreService): Shape {
    const shape = this.construct(restoredId(element), [
      element.attributes.x ?? '0',
      element.attributes.y ?? '0',
      element.text ?? '',
    ]);
    applyRestoredAttributes(shape, element, FIELDS);
    applyElementTransform(shape, element);
    return shape;
  }
  private construct(id: string, parameters: readonly string[]): Shape {
    requireParameterCount(this.type, parameters, 3, 3);
    return new Text(
      id,
      numberParameter(this.type, parameters, 0),
      numberParameter(this.type, parameters, 1),
      parameter(this.type, parameters, 2),
    );
  }
}
