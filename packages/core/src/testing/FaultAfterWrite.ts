import type { AttributeHandler, EditableDocument, ShapeView } from '../index.js';

export class FaultAfterWrite implements AttributeHandler {
  readonly name = 'fault-after-write';
  handles(_target: ShapeView, attribute: string): boolean {
    return attribute === 'probe-fill';
  }
  apply(candidate: EditableDocument, id: string, _attribute: string, value: string): never {
    candidate.require(id).setAttribute('fill', value);
    throw new Error('injected failure after candidate write');
  }
}
