import { DomainError } from '../../index.js';
import { DemoCreateAction } from './DemoCreateAction.js';
import type { Command, CommandPreparation, ShapeCreationService } from '../../index.js';

/** Consumer example of an edit-effect command: metadata only, never a name check. */
export class DemoCreateCommand implements Command {
  readonly name = 'demo-create';
  readonly usage = 'demo-create <id>';
  constructor(private readonly shapes: ShapeCreationService) {}
  prepare(args: readonly string[]): CommandPreparation {
    if (args.length !== 1) throw new DomainError(`usage: ${this.usage}`);
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new DemoCreateAction(this.shapes, args[0]!),
    };
  }
}
