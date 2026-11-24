import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fromRepo, repoRoot, runSession } from './lib/runner.mjs';
import { goldenRoot as defaultGoldenRoot, sessions } from './sessions.mjs';
import { compareRun, readGolden } from './lib/golden.mjs';

function value(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function usage() {
  console.error(
    [
      'usage:',
      '  node scripts/baseline/compare.mjs --entry <compiled-cli.js> [--session <name>] [--work <dir>] [--golden <dir>]',
      '  node scripts/baseline/compare.mjs --pair <expected-session-dir> <actual-session-dir>',
    ].join('\n'),
  );
  process.exit(2);
}

async function comparePair(expectedDirectory, actualDirectory) {
  const expected = await readGolden(expectedDirectory);
  const actual = await readGolden(actualDirectory);
  const differences = compareRun({ ...actual, removed: [] }, { ...expected });
  if (differences.length) {
    console.log(`diff  ${expectedDirectory} != ${actualDirectory}`);
    for (const line of differences) console.log(`      ${line}`);
    return false;
  }
  console.log(`ok    ${expectedDirectory} == ${actualDirectory}`);
  return true;
}

async function compareSessions({ entry, goldenRoot, workRoot, only }) {
  const selected = only ? sessions.filter((session) => session.name === only) : sessions;
  if (!selected.length) {
    console.error(`error: unknown session: ${only}`);
    process.exit(2);
  }
  await mkdir(workRoot, { recursive: true });
  let matched = 0;
  let differed = 0;
  for (const session of selected) {
    const golden = await readGolden(path.join(goldenRoot, session.name));
    const run = await runSession(session, { entry, workRoot });
    const differences = compareRun(run, golden);
    if (differences.length) {
      differed++;
      console.log(
        `diff  ${session.name}  exit expected=${golden.exitCode} actual=${run.exitCode} stdout=${run.stdout.length}B stderr=${run.stderr.length}B`,
      );
      for (const line of differences) console.log(`      ${line}`);
    } else {
      matched++;
      console.log(
        `ok    ${session.name}  exit=${run.exitCode} stdout=${run.stdout.length}B stderr=${run.stderr.length}B files=[${[...golden.produced.keys()].join(', ')}]`,
      );
    }
  }
  console.log(
    `compare: ${selected.length} sessions, ${matched} matched, ${differed} differed (entry ${path.relative(repoRoot, entry).split(path.sep).join('/')}, node ${process.version})`,
  );
  return differed === 0;
}

const argv = process.argv.slice(2);
const pairIndex = argv.indexOf('--pair');

if (pairIndex >= 0) {
  const expected = argv[pairIndex + 1];
  const actual = argv[pairIndex + 2];
  if (!expected || !actual) usage();
  const same = await comparePair(path.resolve(expected), path.resolve(actual));
  process.exit(same ? 0 : 1);
}

const entry = value(argv, '--entry');
if (!entry) usage();
const same = await compareSessions({
  entry: fromRepo(entry),
  goldenRoot: fromRepo(value(argv, '--golden') ?? defaultGoldenRoot),
  workRoot: fromRepo(value(argv, '--work') ?? 'artifacts/baseline'),
  only: value(argv, '--session'),
});
process.exit(same ? 0 : 1);
