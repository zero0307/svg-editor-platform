import {
  Group,
  Numbers,
  Shape,
  ShapeProviderRegistry,
  type ShapeProvider,
  type ShapeRestoreService,
  type SvgElementView,
} from '@svgframe/core';

/** Minimal geometry shape used to exercise the codec without importing builtins. */
export class FakeLeafShape extends Shape {
  private readonly values = new Map<string, number>();
  constructor(
    id: string,
    readonly tag: string,
    values: Readonly<Record<string, number>>,
    private readonly dimensions: readonly string[],
    private readonly xKeys: readonly string[],
    private readonly yKeys: readonly string[],
    private readonly content: string | null,
  ) {
    super(id);
    for (const [name, value] of Object.entries(values))
      this.values.set(
        name,
        this.dimensions.includes(name) ? Numbers.nonnegative(value, name) : value,
      );
  }
  override move(dx: number, dy: number): void {
    for (const key of this.xKeys) this.values.set(key, (this.values.get(key) ?? 0) + dx);
    for (const key of this.yKeys) this.values.set(key, (this.values.get(key) ?? 0) + dy);
  }
  override scale(factor: number): void {
    Numbers.positive(factor, 'scale factor');
    for (const [name, value] of this.values) this.values.set(name, value * factor);
  }
  override clone(): FakeLeafShape {
    const copy = new FakeLeafShape(
      this.id,
      this.tag,
      Object.fromEntries(this.values),
      this.dimensions,
      this.xKeys,
      this.yKeys,
      this.content,
    );
    this.copyPresentationTo(copy);
    return copy;
  }
  override geometry(): Readonly<Record<string, string>> {
    return Object.freeze(
      Object.fromEntries([...this.values].map(([name, value]) => [name, Numbers.format(value)])),
    );
  }
  override textContent(): string | null {
    return this.content;
  }
  override summary(): string {
    return `${[...this.values].map(([name, value]) => `${name}=${value}`).join(' ')}${this.styleSummary()}`;
  }
}

/** Composite fake whose SVG tag stays `g` while its domain kind is `fake-box`. */
export class FakeBoxShape extends Group {
  override get kind(): string {
    return 'fake-box';
  }
  protected override newContainer(): FakeBoxShape {
    return new FakeBoxShape(this.id);
  }
}

interface LeafDefinition {
  readonly type: string;
  readonly tag: string;
  readonly fields: readonly string[];
  readonly dimensions: readonly string[];
  readonly xKeys: readonly string[];
  readonly yKeys: readonly string[];
  readonly text?: boolean;
}

const leafDefinitions: readonly LeafDefinition[] = [
  {
    type: 'rect',
    tag: 'rect',
    fields: ['x', 'y', 'width', 'height'],
    dimensions: ['width', 'height'],
    xKeys: ['x'],
    yKeys: ['y'],
  },
  {
    type: 'circle',
    tag: 'circle',
    fields: ['cx', 'cy', 'r'],
    dimensions: ['r'],
    xKeys: ['cx'],
    yKeys: ['cy'],
  },
  {
    type: 'ellipse',
    tag: 'ellipse',
    fields: ['cx', 'cy', 'rx', 'ry'],
    dimensions: ['rx', 'ry'],
    xKeys: ['cx'],
    yKeys: ['cy'],
  },
  {
    type: 'line',
    tag: 'line',
    fields: ['x1', 'y1', 'x2', 'y2'],
    dimensions: [],
    xKeys: ['x1', 'x2'],
    yKeys: ['y1', 'y2'],
  },
  {
    type: 'text',
    tag: 'text',
    fields: ['x', 'y'],
    dimensions: [],
    xKeys: ['x'],
    yKeys: ['y'],
    text: true,
  },
];

const copyAttributes = (shape: Shape, element: SvgElementView, fields: readonly string[]): void => {
  for (const [name, value] of Object.entries(element.attributes)) {
    if (name === 'id' || fields.includes(name) || name.startsWith('xmlns')) continue;
    if (name === 'fill' || name === 'stroke' || name === 'stroke-width')
      shape.setAttribute(name, value);
    else shape.preserveAttribute(name, value);
  }
};

class FakeLeafProvider implements ShapeProvider {
  readonly defaultTag: string;
  constructor(private readonly definition: LeafDefinition) {
    this.defaultTag = definition.tag;
  }
  get type(): string {
    return this.definition.type;
  }
  matches(): boolean {
    return false;
  }
  create(): Shape {
    throw new Error('create is not used by the codec');
  }
  restore(element: SvgElementView): Shape {
    const values: Record<string, number> = {};
    for (const field of this.definition.fields)
      values[field] = Numbers.parse(element.attributes[field] ?? '0', field);
    const shape = new FakeLeafShape(
      element.id ?? '',
      this.definition.tag,
      values,
      this.definition.dimensions,
      this.definition.xKeys,
      this.definition.yKeys,
      this.definition.text ? (element.text ?? '') : null,
    );
    shape.scale(element.transform.scale);
    shape.move(element.transform.translateX, element.transform.translateY);
    copyAttributes(shape, element, this.definition.fields);
    return shape;
  }
}

/** Restores ordinary groups; the group's own world transform is not re-applied. */
export class FakeGroupProvider implements ShapeProvider {
  readonly type: string = 'g';
  readonly defaultTag = 'g';
  matches(): boolean {
    return false;
  }
  create(): Shape {
    throw new Error('create is not used by the codec');
  }
  restore(element: SvgElementView, shapes: ShapeRestoreService): Shape {
    const group = new Group(element.id ?? '');
    copyAttributes(group, element, []);
    for (const child of element.children) group.insert(shapes.restore(child));
    return group;
  }
}

/** Semantic provider keyed by `data-kind="fake-box"`; restores the complete subtree. */
export class FakeBoxProvider implements ShapeProvider {
  readonly type: string = 'fake-box';
  matches(element: SvgElementView): boolean {
    return element.attributes['data-kind'] === 'fake-box';
  }
  create(): Shape {
    throw new Error('create is not used by the codec');
  }
  restore(element: SvgElementView, shapes: ShapeRestoreService): Shape {
    const box = new FakeBoxShape(element.id ?? '');
    copyAttributes(box, element, []);
    for (const child of element.children) box.insert(shapes.restore(child));
    return box;
  }
}

/** Provider registry with the six Phase 1 tags plus the composite fake type. */
export const createProviderRegistry = (
  options: { readonly withBox?: boolean } = {},
): ShapeProviderRegistry => {
  const registry = new ShapeProviderRegistry();
  for (const definition of leafDefinitions) registry.register(new FakeLeafProvider(definition));
  registry.register(new FakeGroupProvider());
  if (options.withBox !== false) registry.register(new FakeBoxProvider());
  return registry;
};

/** A second semantic provider sharing the fake-box marker, for ambiguity tests. */
export class DuplicateBoxProvider extends FakeBoxProvider {
  override readonly type = 'fake-box-duplicate';
}

/** A second tag-default provider for `g`, for ambiguity tests. */
export class AlternateGroupProvider extends FakeGroupProvider {
  override readonly type = 'g-alternate';
}

/** A numeric attribute accessor used by tests. */
export const numericAttribute = (shape: Shape, name: string): number =>
  Number(shape.attributes()[name]);
