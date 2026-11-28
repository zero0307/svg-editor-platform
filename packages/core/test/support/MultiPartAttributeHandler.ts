import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
  ReadonlyShape,
} from '../../index.js';

/** Handler that changes two sub-parts of one composite in a single apply call. */
export class MultiPartAttributeHandler implements AttributeHandler {
  readonly name = 'multi-part';
  calls = 0;
  handles(target: ReadonlyShape, attribute: string): boolean {
    return target.kind === 'demo-box' && attribute === 'label';
  }
  apply(context: AttributeEditContext, request: AttributeRequest): AttributeResult {
    this.calls += 1;
    context.document.require(`${request.targetId}-rect`).setAttribute('fill', 'painted');
    context.document.require(`${request.targetId}-label`).setAttribute('fill', 'labelled');
    return { message: `label=${request.value}` };
  }
}
