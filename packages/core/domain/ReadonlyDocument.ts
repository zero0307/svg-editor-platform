import type { ReadonlyShape } from './ReadonlyShape.js';

/** Read-only capability of the current document, as exposed to queries. */
export interface ReadonlyDocument {
  readonly width: number;
  readonly height: number;
  readonly root: ReadonlyShape;
  all(): readonly ReadonlyShape[];
  find(id: string): ReadonlyShape | undefined;
  require(id: string): ReadonlyShape;
  container(id: string): ReadonlyShape;
}
