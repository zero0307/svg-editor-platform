import { createReadStream } from 'node:fs';
import { createApplication } from './Application.js';
import { Repl } from './Repl.js';

const USAGE = 'error: usage: npm run cli -- [--script <file> | --help]';

interface ParsedArguments {
  readonly script?: string;
  readonly config?: string;
}

const parseArguments = (args: readonly string[]): ParsedArguments | undefined => {
  let script: string | undefined;
  let config: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === '--script') {
      if (index + 1 >= args.length) return undefined;
      script = args[++index]!;
      continue;
    }
    if (argument === '--config') {
      const candidate = args[index + 1];
      if (candidate !== undefined && !candidate.startsWith('--')) {
        config = candidate;
        index++;
      } else {
        config = 'plugins.config.json';
      }
      continue;
    }
    return undefined;
  }
  return { script, config };
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    const application = await createApplication();
    console.log((await application.dispatcher.help()).join('\n'));
    return;
  }
  const parsed = parseArguments(args);
  if (!parsed) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const application = await createApplication({
    configPath: parsed.config,
    onPluginError: (message) => console.error(`error: ${message}`),
  });
  const input = parsed.script
    ? createReadStream(parsed.script, { encoding: 'utf8' })
    : process.stdin;
  const interactive = parsed.script === undefined && Boolean(process.stdin.isTTY);
  const success = await new Repl(application.dispatcher).run(input, process.stdout, interactive);
  if (!success && !interactive) process.exitCode = 1;
};

try {
  await main();
} catch (error) {
  const args = process.argv.slice(2);
  const scriptIndex = args.indexOf('--script');
  const script = scriptIndex >= 0 ? args[scriptIndex + 1] : undefined;
  console.error(`error: ${script ? `cannot read script: ${script}` : messageOf(error)}`);
  process.exitCode = 1;
}
