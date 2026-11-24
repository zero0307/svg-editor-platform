import type { TreeRow } from '../domain/TreeRow.js';
import type { EditorEvent } from '../events/EditorEvent.js';

/**
 * Adds an optional suffix to one read-only tree row, for example `*` or `(box)`.
 *
 * The framework joins suffixes in registration order with one leading space and
 * adds nothing for `null` or an empty string, so the no-decorator output keeps the
 * Phase 1 bytes. `decorate` is a pure read of the row/document; failures are
 * isolated by the tree pipeline (a faulty decorator is reported and disabled).
 * Committed document events arrive through `onEvent` for stateful decorators such
 * as the modified-star baseline map.
 */
export interface TreeDecorator {
  /** Stable registration name, for example `modified-star` or `box-type-label`. */
  readonly name: string;
  decorate(row: TreeRow): string | null;
  /** Optional observer for committed document events; must not throw to signal failure. */
  onEvent?(event: EditorEvent): void;
}
