import { DomainError, Numbers } from '../../index.js';
import type { Command, CommandPreparation } from '../../index.js';

/**
 * Consumer example mirroring `canvas`: no arguments is a read-only query, size
 * arguments are a document effect. The dispatcher picks the path from `effect`.
 */
export class DemoCanvasCommand implements Command {
  readonly name = 'demo-canvas';
  readonly usage = 'demo-canvas [w h]';
  prepare(args: readonly string[]): CommandPreparation {
    if (args.length === 0) {
      return {
        requiresDocument: true,
        effect: 'query',
        operation: {
          execute: (context) => {
            const document = context.document();
            return `canvas ${document.width}x${document.height}`;
          },
        },
      };
    }
    if (args.length !== 2) throw new DomainError(`usage: ${this.usage}`);
    const width = Numbers.parse(args[0]!, 'width');
    const height = Numbers.parse(args[1]!, 'height');
    return {
      requiresDocument: true,
      effect: 'document',
      operation: { execute: (session) => session.canvas(width, height) },
    };
  }
}
