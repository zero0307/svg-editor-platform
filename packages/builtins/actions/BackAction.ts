import { DomainError, EditAction } from '@svgframe/core';
import type { SvgDocument } from '@svgframe/core';

/** Moves one shape to the beginning of its sibling list. */
export class BackAction extends EditAction {
  constructor(private readonly id: string) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    const shape = candidate.require(this.id);
    const parent = shape.parent;
    if (!parent) throw new DomainError(`cannot move root: ${shape.id}`);
    parent.insert(shape, 0);
    return `${shape.kind}#${shape.id} moved to back`;
  }
}
