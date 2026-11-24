import { DemoBoxShape } from './DemoBoxShape.js';
import type { Shape } from '../../index.js';

/**
 * Test composite that protects its two necessary parts: deleting or moving a
 * `-rect`/`-label` child is rejected, deleting the whole box is allowed and
 * `ungroup` is refused before the ordinary top-level check.
 */
export class ProtectedBoxShape extends DemoBoxShape {
  override canUngroup(): boolean {
    return false;
  }
  override canRemoveChild(child: Shape): boolean {
    return !this.isNecessary(child);
  }
  private isNecessary(child: Shape): boolean {
    return child.id === `${this.id}-rect` || child.id === `${this.id}-label`;
  }
  protected override newContainer(): ProtectedBoxShape {
    return new ProtectedBoxShape(this.id);
  }
}
