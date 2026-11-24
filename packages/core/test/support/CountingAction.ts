import { DomainError, EditAction } from '../../index.js';
import type { SvgDocument } from '../../index.js';

/**
 * Edit action that counts applications and can mutate the candidate before
 * failing. Used to prove transaction failure atomicity and that undo/redo reuse
 * snapshots instead of re-running the action.
 */
export class CountingAction extends EditAction {
  calls = 0;
  constructor(
    private readonly mutate?: (candidate: SvgDocument) => void,
    private readonly failure?: string,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    this.calls += 1;
    this.mutate?.(candidate);
    if (this.failure) throw new DomainError(this.failure);
    return 'counted edit';
  }
}
