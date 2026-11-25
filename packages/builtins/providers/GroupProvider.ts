import { Group } from '../shapes/Group.js';
import { applyRestoredAttributes, requireParameterCount, restoredId } from './ProviderSupport.js';
import type {
  Shape,
  ShapeCreationRequest,
  ShapeCreationService,
  ShapeProvider,
  ShapeRestoreService,
  SvgElementView,
} from '@svgframe/core';

export class GroupProvider implements ShapeProvider {
  readonly type = 'g';
  readonly defaultTag = 'g';
  readonly usage = 'g <id>';
  create(request: ShapeCreationRequest, _shapes: ShapeCreationService): Shape {
    requireParameterCount(this.type, request.parameters, 0, 0);
    return new Group(request.id);
  }
  matches(_element: SvgElementView): boolean {
    return false;
  }
  restore(element: SvgElementView, shapes: ShapeRestoreService): Shape {
    const group = new Group(restoredId(element));
    applyRestoredAttributes(group, element, []);
    for (const child of element.children) group.insert(shapes.restore(child));
    return group;
  }
}
