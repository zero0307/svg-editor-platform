import { CommandArguments } from './CommandArguments.js';
import type { Command, CommandPreparation } from '@svgframe/core';

export class CanvasCommand implements Command {
  readonly name = 'canvas';
  readonly usage = 'canvas [w h]';
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
    const arguments_ = new CommandArguments(args, this.usage);
    arguments_.requireCount(2);
    const width = arguments_.number(0);
    const height = arguments_.number(1);
    return {
      requiresDocument: true,
      effect: 'document',
      operation: { execute: (session) => session.canvas(width, height) },
    };
  }
}
