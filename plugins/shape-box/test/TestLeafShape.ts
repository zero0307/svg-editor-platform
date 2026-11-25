import { Numbers, Shape } from '@svgframe/core';

const X_KEYS = new Set(['x', 'cx', 'x1', 'x2']);
const Y_KEYS = new Set(['y', 'cy', 'y1', 'y2']);

/**
 * Core-only leaf double for box plugin tests: it mimics the observable geometry,
 * text and presentation behavior of the builtins leaves without importing them.
 */
export class TestLeafShape extends Shape {
  readonly tag: string;
  private readonly kindName: string;
  private readonly values = new Map<string, number>();
  private content: string | null;
  constructor(
    id: string,
    tag: string,
    values: Readonly<Record<string, number>> = {},
    content: string | null = null,
    kind: string = tag,
  ) {
    super(id);
    this.tag = tag;
    this.kindName = kind;
    this.content = content;
    for (const [name, value] of Object.entries(values)) this.values.set(name, value);
  }
  override get kind(): string {
    return this.kindName;
  }
  override move(dx: number, dy: number): void {
    Numbers.finite(dx, 'dx');
    Numbers.finite(dy, 'dy');
    for (const name of this.values.keys()) {
      if (X_KEYS.has(name)) this.values.set(name, this.values.get(name)! + dx);
      if (Y_KEYS.has(name)) this.values.set(name, this.values.get(name)! + dy);
    }
  }
  override scale(factor: number): void {
    Numbers.positive(factor, 'scale factor');
    for (const [name, value] of this.values)
      this.values.set(name, Numbers.finite(value * factor, name));
  }
  override clone(): TestLeafShape {
    return new TestLeafShape(
      this.id,
      this.tag,
      Object.fromEntries(this.values),
      this.content,
      this.kindName,
    );
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
    return '';
  }
  protected override setSpecificAttribute(name: string, value: string): void {
    if (name === 'text') {
      this.content = value;
      return;
    }
    super.setSpecificAttribute(name, value);
  }
}
