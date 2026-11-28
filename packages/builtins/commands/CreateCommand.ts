import { CreateAction } from '@svgframe/core';
import { DomainError } from '@svgframe/core';
import type {
  Command,
  CommandPreparation,
  CommandToken,
  ShapeCreationService,
} from '@svgframe/core';

export class CreateCommand implements Command {
  readonly name = 'create';
  readonly usage = 'create <type> <id> [params...] [in <containerId>]';
  constructor(private readonly shapes: ShapeCreationService) {}
  prepare(args: readonly string[]): CommandPreparation {
    return this.parse(args.map((value) => ({ value, quoted: false })));
  }
  prepareTokens(tokens: readonly CommandToken[]): CommandPreparation {
    return this.parse(tokens);
  }
  private parse(tokens: readonly CommandToken[]): CommandPreparation {
    if (tokens.length < 2) throw new DomainError(`usage: ${this.usage}`);
    const type = tokens[0]!.value;
    const id = tokens[1]!.value;
    const marker = tokens.at(-2);
    let parameters: readonly string[];
    let containerId: string | undefined;
    if (marker?.value === 'in' && !marker.quoted && tokens.length >= 4) {
      parameters = tokens.slice(2, tokens.length - 2).map((token) => token.value);
      containerId = tokens.at(-1)!.value;
    } else {
      parameters = tokens.slice(2).map((token) => token.value);
    }
    return {
      requiresDocument: true,
      effect: 'edit',
      action: new CreateAction(this.shapes, type, id, parameters, containerId),
    };
  }
}
