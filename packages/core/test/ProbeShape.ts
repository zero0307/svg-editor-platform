import type { EditableShape, ShapeView } from '@svgframe/core';

export class ProbeShape implements EditableShape {
  readonly container = null;
  constructor(
    readonly id: string,
    private x = 0,
    private y = 0,
    private fill = '',
  ) {}
  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }
  scale(factor: number): void {
    this.x *= factor;
    this.y *= factor;
  }
  clone(): ProbeShape {
    return new ProbeShape(this.id, this.x, this.y, this.fill);
  }
  validateInvariant(): void {
    if (!Number.isFinite(this.x + this.y)) throw new Error('invalid coordinates');
  }
  setAttribute(name: string, value: string): void {
    if (name !== 'fill') throw new Error('unknown attribute: ' + name);
    this.fill = value;
  }
  snapshot(): ShapeView {
    return {
      id: this.id,
      kind: 'probe',
      tag: 'rect',
      isContainer: false,
      attributes: { fill: this.fill, x: String(this.x), y: String(this.y) },
      text: null,
      children: [],
    };
  }
}
