import type { ContainerShape } from './ContainerShape.js';
import type { ReadonlyDocument } from './ReadonlyDocument.js';
import type { Shape } from './Shape.js';

/**
 * Mutable candidate-document capability handed to edit actions and attribute
 * handlers. It is only ever the detached working copy, never the live document.
 */
export interface EditableDocument extends ReadonlyDocument {
  readonly root: ContainerShape;
  all(): readonly Shape[];
  find(id: string): Shape | undefined;
  require(id: string): Shape;
  container(id: string): ContainerShape;
  ensureAvailable(id: string): void;
  add(shape: Shape, parent?: ContainerShape): void;
  resize(width: number, height: number): void;
}
