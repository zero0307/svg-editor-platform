import { Shape } from './Shape.js';

/**
 * Public container capability. Structural operations live here so composite
 * plugins can be containers without the kernel testing names or leaf counts.
 */
export abstract class ContainerShape extends Shape {
  abstract indexOf(shape: Shape): number;
  abstract contains(shape: Shape): boolean;
  abstract insert(shape: Shape, index?: number): void;
  abstract remove(shape: Shape): void;
  /**
   * Structural policy: may `child` be deleted or moved out of this container?
   * Composite containers reject their necessary parts; the whole composite can
   * still be removed from its own parent.
   */
  canRemoveChild(_child: Shape): boolean {
    return true;
  }
  /** Structural policy: may `child` be inserted or moved into this container? */
  canInsertChild(_child: Shape): boolean {
    return true;
  }
}
