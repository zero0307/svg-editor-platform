import { Group } from '../../index.js';
import type { Shape } from '../../index.js';

/** Test container that rejects one specific child id, to exercise insertion policy. */
export class RejectingGroup extends Group {
  override canInsertChild(child: Shape): boolean {
    return child.id !== 'blocked';
  }
  protected override newContainer(): RejectingGroup {
    return new RejectingGroup(this.id);
  }
}
