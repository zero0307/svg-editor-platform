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
}
