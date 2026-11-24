import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
  ReadonlyShape,
} from '../../index.js';

/** Consumer example of a pure `handles` query plus a candidate-document `apply`. */
export class DemoAttributeHandler implements AttributeHandler {
  readonly name = 'demo-attributes';
  handles(target: ReadonlyShape, attribute: string): boolean {
    return target.kind === 'demo-box' && attribute === 'fill';
  }
  apply(context: AttributeEditContext, request: AttributeRequest): AttributeResult {
    const rect = context.document.require(`${request.targetId}-rect`);
    rect.setAttribute('fill', request.value);
    return { message: `fill=${request.value}` };
  }
}
