import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { CommandDispatcher } from './CommandDispatcher.js';

/** Phase 1 REPL: serial lines, error continuation, prompt only when interactive. */
export class Repl {
  constructor(private readonly dispatcher: CommandDispatcher) {}
  async run(input: Readable, output: Writable, interactive: boolean): Promise<boolean> {
    const lines = createInterface({ input, crlfDelay: Infinity, terminal: false });
    let success = true;
    if (interactive) output.write("svg-editor 1.0 — type 'help' for commands\nsvg> ");
    for await (const line of lines) {
      const result = await this.dispatcher.execute(line);
      for (const message of result) output.write(`${message}\n`);
      if (result.some((message) => message.startsWith('error:'))) success = false;
      if (interactive) output.write('svg> ');
    }
    if (interactive) output.write('\n');
    return success;
  }
}
