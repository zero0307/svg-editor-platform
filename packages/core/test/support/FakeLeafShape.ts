import { DomainError, Shape } from '../../index.js';

/** Minimal concrete leaf used to exercise the document and provider contracts. */
export class FakeLeafShape extends Shape {
  readonly tag: string;
  private positionX = 0;
  private positionY = 0;
  /** When set, `validateInvariant` rejects the node with this message. */
  violation: string | null = null;
  constructor(id: string, tag = 'rect') {
    super(id);
    this.tag = tag;
  }
  override move(dx: number, dy: number): void {
    this.positionX += dx;
    this.positionY += dy;
  }
  override scale(factor: number): void {
    this.positionX *= factor;
    this.positionY *= factor;
  }
  override geometry(): Readonly<Record<string, string>> {
    return { x: String(this.positionX), y: String(this.positionY) };
  }
  override summary(): string {
    return `x=${this.positionX} y=${this.positionY}`;
  }
  override textContent(): string | null {
    return this.tag === 'text' ? 'fake text' : null;
  }
  override validateInvariant(): void {
    if (this.violation) throw new DomainError(this.violation);
  }
  override clone(): FakeLeafShape {
    const copy = new FakeLeafShape(this.id, this.tag);
    this.copyPresentationTo(copy);
    copy.positionX = this.positionX;
    copy.positionY = this.positionY;
    copy.violation = this.violation;
    return copy;
  }
}
