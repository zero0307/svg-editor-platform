import { DomainError } from '../domain/DomainError.js';
import type { TreeRow } from '../domain/TreeRow.js';
import type { EditorEvent } from '../events/EditorEvent.js';
import type { TreeDecorator } from '../extensions/TreeDecorator.js';

/**
 * Test double for a broken decorator: either the row rendering or the committed
 * event observer fails. The tree pipeline must report the failure, disable this
 * decorator and keep the committed document and other suffixes intact.
 */
export class FaultyTreeDecorator implements TreeDecorator {
  constructor(
    readonly name = 'faulty-decorator',
    private readonly failure: 'decorate' | 'event' = 'decorate',
  ) {}
  decorate(_row: TreeRow): string | null {
    if (this.failure === 'decorate') throw new DomainError(`tree decorator failed: ${this.name}`);
    return null;
  }
  onEvent(_event: EditorEvent): void {
    if (this.failure === 'event')
      throw new DomainError(`tree decorator event failed: ${this.name}`);
  }
}
