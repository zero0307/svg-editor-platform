import { DomainError } from '@svgframe/core';
import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
  ReadonlyShape,
} from '@svgframe/core';

/**
 * Composite attribute semantics for the test-only `stamp` type.
 *
 * `caption` edits two role parts (label text and frame fill) inside one candidate
 * document, which is exactly the "one attribute request, several parts, one undo
 * unit" contract; `fill` edits only the frame.
 */
export class StampAttributes implements AttributeHandler {
  readonly name = 'stamp-attributes';
  handles(target: ReadonlyShape, attribute: string): boolean {
    return target.kind === 'stamp' && (attribute === 'caption' || attribute === 'fill');
  }
  apply(context: AttributeEditContext, request: AttributeRequest): AttributeResult {
    const stamp = context.document.require(request.targetId);
    const label = context.document.require(`${stamp.id}-label`);
    const frame = context.document.require(`${stamp.id}-frame`);
    if (label.tag !== 'text') throw new DomainError(`invalid stamp label: ${label.id}`);
    if (frame.tag !== 'rect') throw new DomainError(`invalid stamp frame: ${frame.id}`);
    if (request.attribute === 'caption') {
      label.setAttribute('text', request.value);
      frame.setAttribute('fill', 'blue');
      return { message: `stamp#${stamp.id} caption=${JSON.stringify(request.value)}` };
    }
    frame.setAttribute('fill', request.value);
    return { message: `stamp#${stamp.id} fill=${JSON.stringify(request.value)}` };
  }
}
