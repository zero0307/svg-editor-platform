import { EditAction } from '@svgframe/core';
import type { SvgDocument } from '@svgframe/core';

/** `move <id> <dx> <dy>` on the candidate document. */
export class MoveAction extends EditAction {
  constructor(
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    const shape = candidate.require(this.id);
    shape.move(this.dx, this.dy);
    const detail = shape.summary();
    return `${shape.kind}#${shape.id} moved by (${this.dx},${this.dy})${detail ? `: ${detail}` : ''}`;
  }
}
