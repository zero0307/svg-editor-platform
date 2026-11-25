import { DomainError, EditAction } from '@svgframe/core';
import type { SvgDocument } from '@svgframe/core';

/** `scale <id> <factor>` on the candidate document; factor must be positive. */
export class ScaleAction extends EditAction {
  constructor(
    private readonly id: string,
    private readonly factor: number,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    if (this.factor <= 0) throw new DomainError('scale factor must be positive');
    const shape = candidate.require(this.id);
    shape.scale(this.factor);
    return `${shape.tag}#${shape.id} scaled by ${this.factor}`;
  }
}
