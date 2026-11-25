import type { EditorEvent, TreeDecorator, TreeRow } from '@svgframe/core';

/**
 * Test-only decorator: adds `(stamp)` to rows whose domain kind is `stamp` and
 * records committed editor events. It reads only the read-only row, so the base
 * tree bytes stay untouched for every other node.
 */
export class StampBadgeDecorator implements TreeDecorator {
  readonly name = 'stamp-badge';
  readonly events: string[] = [];
  decorate(row: TreeRow): string | null {
    return row.node.kind === 'stamp' ? '(stamp)' : null;
  }
  onEvent(event: EditorEvent): void {
    this.events.push(event.type);
  }
}
