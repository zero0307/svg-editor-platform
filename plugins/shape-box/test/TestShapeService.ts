import { FakeShapeCreationService, FakeShapeRestoreService, Numbers } from '@svgframe/core';
import { BoxProvider } from '../BoxProvider.js';
import { TestLeafShape } from './TestLeafShape.js';
import type {
  Shape,
  ShapeCreationRequest,
  ShapeCreationService,
  SvgElementView,
} from '@svgframe/core';

const num = (value: string | undefined): number => Numbers.parse(value ?? '', 'parameter');

function leafFromParameters(request: ShapeCreationRequest): TestLeafShape {
  if (request.type === 'rect') {
    const shape = new TestLeafShape(request.id, 'rect', {
      x: num(request.parameters[0]),
      y: num(request.parameters[1]),
      width: num(request.parameters[2]),
      height: num(request.parameters[3]),
    });
    const fill = request.parameters[4];
    if (fill !== undefined) shape.setAttribute('fill', fill);
    return shape;
  }
  return new TestLeafShape(
    request.id,
    'text',
    { x: num(request.parameters[0]), y: num(request.parameters[1]) },
    request.parameters[2] ?? '',
  );
}

/**
 * Public-port-only composition used by box unit tests: `box` goes through the real
 * provider, and `rect`/`text` are core-only doubles, so builtins are never loaded.
 */
export class TestShapeService implements ShapeCreationService {
  readonly parts = new FakeShapeCreationService({
    rect: leafFromParameters,
    text: leafFromParameters,
  });
  private readonly provider = new BoxProvider();
  create(request: ShapeCreationRequest): Shape {
    return request.type === 'box'
      ? this.provider.create(request, this)
      : this.parts.create(request);
  }
}

/** Leaf recipe for provider restore tests: geometry/text come from the view only. */
export function leafFromView(view: SvgElementView): TestLeafShape {
  const values: Record<string, number> = {};
  for (const name of [
    'x',
    'y',
    'width',
    'height',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x1',
    'y1',
    'x2',
    'y2',
  ]) {
    const value = view.attributes[name];
    if (value !== undefined) values[name] = Numbers.parse(value, name);
  }
  return new TestLeafShape(view.id ?? view.tag, view.tag, values, view.text);
}

/** Restore service that recursively dispatches explicit `data-kind="box"` views. */
export function testRestorer(provider: BoxProvider): FakeShapeRestoreService {
  let service: FakeShapeRestoreService;
  service = new FakeShapeRestoreService((view) =>
    provider.matches(view) ? provider.restore(view, service) : leafFromView(view),
  );
  return service;
}

/** Builds one `SvgElementView` node; transforms default to identity. */
export function view(
  tag: string,
  id: string | null,
  attributes: Readonly<Record<string, string>> = {},
  children: readonly SvgElementView[] = [],
  text: string | null = null,
  transform: SvgElementView['transform'] = { scale: 1, translateX: 0, translateY: 0 },
): SvgElementView {
  return { tag, id, attributes, children, text, transform };
}
