import { Numbers } from '@svgframe/core';
import { StampPartShape } from './StampPartShape.js';
import type {
  Shape,
  ShapeCreationRequest,
  ShapeCreationService,
  ShapeProvider,
  ShapeRestoreService,
  SvgElementView,
} from '@svgframe/core';

const GEOMETRY = ['x', 'y', 'width', 'height'] as const;
const PRESENTATION = ['fill', 'stroke', 'stroke-width'] as const;

/** Leaf providers for the two `stamp` role parts; one instance per role tag. */
export class StampPartProvider implements ShapeProvider {
  readonly type: string;
  readonly defaultTag: 'rect' | 'text';
  readonly usage: string;
  constructor(type: string, defaultTag: 'rect' | 'text', usage: string) {
    this.type = type;
    this.defaultTag = defaultTag;
    this.usage = usage;
  }
  matches(_element: SvgElementView): boolean {
    return false;
  }
  create(request: ShapeCreationRequest, _shapes: ShapeCreationService): Shape {
    if (this.defaultTag === 'rect')
      return new StampPartShape(request.id, 'rect', { x: 0, y: 0, width: 40, height: 20 });
    return new StampPartShape(request.id, 'text', { x: 4, y: 14 }, request.parameters[0] ?? '');
  }
  restore(element: SvgElementView, _shapes: ShapeRestoreService): Shape {
    const values: Record<string, number> = {};
    for (const name of GEOMETRY) {
      const value = element.attributes[name];
      if (value !== undefined) values[name] = Numbers.parse(value, name);
    }
    const part = new StampPartShape(
      element.id ?? this.type,
      this.defaultTag,
      values,
      element.text ?? '',
    );
    for (const name of PRESENTATION) {
      const value = element.attributes[name];
      if (value !== undefined) part.setAttribute(name, value);
    }
    // Leaf providers apply the already-normalized world transform exactly once.
    part.scale(element.transform.scale);
    part.move(element.transform.translateX, element.transform.translateY);
    return part;
  }
}
