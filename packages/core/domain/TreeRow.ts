import type { ReadonlyDocument } from './ReadonlyDocument.js';
import type { ReadonlyShape } from './ReadonlyShape.js';

/**
 * Read-only context for one rendered tree row. Decorators read the document and
 * the node/parent links; they never receive mutable domain objects.
 */
export interface TreeRow {
  readonly document: ReadonlyDocument;
  readonly node: ReadonlyShape;
  readonly parent: ReadonlyShape | null;
  readonly depth: number;
}
