import { ContainerShape, DomainError, Numbers, Shape } from '@svgframe/core';

/**
 * Test-only composite type: SVG tag `g`, domain kind `stamp`, with two necessary
 * role parts. It exists only to prove the generic extension points work without
 * any kernel branch or built-in/plugin name.
 */
export class StampShape extends ContainerShape {
  readonly tag = 'g';
  private readonly members: Shape[] = [];
  override get kind(): string {
    return 'stamp';
  }
  override children(): readonly Shape[] {
    return [...this.members];
  }
  indexOf(shape: Shape): number {
    return this.members.indexOf(shape);
  }
  contains(shape: Shape): boolean {
    return this.members.some(
      (child) => child === shape || (child instanceof ContainerShape && child.contains(shape)),
    );
  }
  insert(shape: Shape, index = this.members.length): void {
    if (shape === this || (shape instanceof ContainerShape && shape.contains(this)))
      throw new DomainError(`cannot move a container into its own descendant: ${shape.id}`);
    if (!Number.isInteger(index) || index < 0 || index > this.members.length)
      throw new DomainError('invalid child position');
    shape.parent?.remove(shape);
    this.members.splice(Math.min(index, this.members.length), 0, shape);
    shape.attach(this);
  }
  remove(shape: Shape): void {
    const index = this.indexOf(shape);
    if (index < 0) throw new DomainError(`no such child: ${shape.id}`);
    this.members.splice(index, 1);
    shape.attach(null);
  }
  override move(dx: number, dy: number): void {
    Numbers.finite(dx, 'dx');
    Numbers.finite(dy, 'dy');
    this.members.forEach((child) => child.move(dx, dy));
  }
  override scale(factor: number): void {
    Numbers.positive(factor, 'scale factor');
    this.members.forEach((child) => child.scale(factor));
  }
  override clone(): StampShape {
    const copy = new StampShape(this.id);
    this.copyPresentationTo(copy);
    this.members.forEach((child) => copy.insert(child.clone()));
    return copy;
  }
  override geometry(): Readonly<Record<string, string>> {
    return Object.freeze({});
  }
  override summary(): string {
    return '';
  }
  override canUngroup(): boolean {
    return false;
  }
  override canRemoveChild(child: Shape): boolean {
    return child.id !== this.partId('frame') && child.id !== this.partId('label');
  }
  partId(role: 'frame' | 'label'): string {
    return `${this.id}-${role}`;
  }
  /** Both necessary parts must stay present and keep their role tag. */
  override validateInvariant(): void {
    const frame = this.part('frame');
    const label = this.part('label');
    if (!frame)
      throw new DomainError(`incomplete stamp: ${this.id} is missing ${this.partId('frame')}`);
    if (frame.tag !== 'rect')
      throw new DomainError(`invalid stamp: ${frame.id} must be a <rect> part`);
    if (!label)
      throw new DomainError(`incomplete stamp: ${this.id} is missing ${this.partId('label')}`);
    if (label.tag !== 'text')
      throw new DomainError(`invalid stamp: ${label.id} must be a <text> part`);
  }
  private part(role: 'frame' | 'label'): Shape | undefined {
    return this.members.find((child) => child.id === this.partId(role));
  }
}
