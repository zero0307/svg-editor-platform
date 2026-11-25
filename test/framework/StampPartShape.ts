import { DomainError, Numbers, Shape, SvgString } from '@svgframe/core';

/**
 * Test-only leaf part of the `stamp` composite. It is deliberately not one of the
 * built-in shapes: the framework acceptance test registers only `stamp`,
 * `stamp-frame` and `stamp-label`, so nothing here depends on a business plugin.
 */
export class StampPartShape extends Shape {
  readonly tag: 'rect' | 'text';
  private readonly values = new Map<string, number>();
  private content: string;
  constructor(
    id: string,
    tag: 'rect' | 'text',
    values: Readonly<Record<string, number>>,
    content = '',
  ) {
    super(id);
    this.tag = tag;
    for (const [name, value] of Object.entries(values))
      this.values.set(name, Numbers.finite(value, name));
    this.content = content;
  }
  override move(dx: number, dy: number): void {
    Numbers.finite(dx, 'dx');
    Numbers.finite(dy, 'dy');
    for (const name of ['x']) {
      if (this.values.has(name))
        this.values.set(name, Numbers.finite(this.values.get(name)! + dx, name));
    }
    for (const name of ['y']) {
      if (this.values.has(name))
        this.values.set(name, Numbers.finite(this.values.get(name)! + dy, name));
    }
  }
  override scale(factor: number): void {
    Numbers.positive(factor, 'scale factor');
    for (const [name, value] of this.values)
      this.values.set(name, Numbers.finite(value * factor, name));
  }
  override clone(): StampPartShape {
    const copy = new StampPartShape(
      this.id,
      this.tag,
      Object.fromEntries(this.values),
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
    return this.tag === 'text' ? this.content : null;
  }
  override summary(): string {
    if (this.tag === 'text')
      return `(${this.values.get('x') ?? 0},${this.values.get('y') ?? 0}) ${JSON.stringify(this.content)}`;
    return `x=${this.values.get('x') ?? 0} y=${this.values.get('y') ?? 0} w=${this.values.get('width') ?? 0} h=${this.values.get('height') ?? 0}`;
  }
  setText(value: string): void {
    SvgString.validate(value, 'text');
    this.content = value;
  }
  protected override setSpecificAttribute(name: string, value: string): void {
    if (this.values.has(name)) {
      this.values.set(name, Numbers.parse(value, name));
      return;
    }
    if (name === 'text' && this.tag === 'text') {
      this.setText(value);
      return;
    }
    throw new DomainError(`unknown attribute: ${name}`);
  }
}
