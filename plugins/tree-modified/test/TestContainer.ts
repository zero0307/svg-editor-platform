import { ContainerShape, DomainError, Numbers, Shape } from '@svgframe/core';

/** Core-only container double; `kind` may be `g` or a plugin type such as `box`. */
export class TestContainer extends ContainerShape {
  readonly tag = 'g';
  private readonly kindName: string;
  private readonly members: Shape[] = [];
  constructor(id: string, kind = 'g') {
    super(id);
    this.kindName = kind;
  }
  override get kind(): string {
    return this.kindName;
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
  override clone(): TestContainer {
    const copy = new TestContainer(this.id, this.kindName);
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
}
