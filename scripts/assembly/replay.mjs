import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromRepo, repoRoot, runSession, snapshotDirectory } from '../baseline/lib/runner.mjs';
import { compareRun, readGolden } from '../baseline/lib/golden.mjs';
import { goldenRoot, sessions as baselineSessions } from '../baseline/sessions.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const POSIX = (value) => value.split(path.sep).join('/');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

const argv = process.argv.slice(2);
const entry = path.resolve(repoRoot, option(argv, '--entry', 'apps/cli/dist/main.js'));
const configPath = path.resolve(repoRoot, option(argv, '--config', 'plugins.config.json'));
const integration = option(argv, '--integration', 'd2b5e23');
const outDirectory = path.resolve(repoRoot, option(argv, '--out', 'doc/evidence/assembly'));
const workRoot = path.resolve(repoRoot, option(argv, '--work', 'artifacts/assembly'));
const noPluginsConfig = path.resolve(
  repoRoot,
  option(argv, '--no-plugins-config', 'test/fixtures/plugins/no-optional-plugins.json'),
);

/**
 * Three Phase 2 sessions replayed through both roots. Inputs are commands only; the box and
 * stats-dir transcripts are frozen in doc/transcript. `stats-dir` runs inside a copy of the
 * fixed directory fixture so `dir` lists a reproducible cwd and logs stay outside it.
 */
const replaySessions = [
  {
    name: 'basic',
    transcript: 'doc/transcript/baseline-basic.txt',
    seedFiles: ['test/fixtures/svg/other.svg'],
    note: 'Phase 1 §6 base session (errors are part of the frozen input)',
  },
  {
    name: 'box',
    transcript: 'doc/transcript/box.txt',
    note: 'Phase 1 §6.1B box session',
  },
  {
    name: 'stats-dir',
    transcript: 'doc/transcript/stats-dir.txt',
    seedTree: 'test/fixtures/dir/tree',
    note: 'stats + dir commands on the fixed directory fixture',
  },
];

async function seedDescription(session) {
  if (session.seedTree) {
    const tree = await snapshotDirectory(fromRepo(session.seedTree));
    const digest = sha256(
      Buffer.from(
        [...tree.entries()]
          .map(([file, hash]) => `${file} ${hash}`)
          .sort()
          .join('\n'),
      ),
    );
    return { kind: 'tree', path: session.seedTree, files: tree.size, sha256: digest };
  }
  const files = [];
  for (const file of session.seedFiles ?? []) {
    files.push({ path: file, sha256: sha256(await readFile(fromRepo(file))) });
  }
  return { kind: files.length ? 'files' : 'empty', files };
}

function streamRecord(run) {
  return {
    exitCode: run.exitCode,
    stdoutBytes: run.stdout.length,
    stderrBytes: run.stderr.length,
    stdoutSha256: sha256(run.stdout),
    stderrSha256: sha256(run.stderr),
    files: [...run.produced.entries()]
      .map(([file, content]) => ({ path: file, bytes: content.length, sha256: sha256(content) }))
      .sort((left, right) => (left.path < right.path ? -1 : 1)),
  };
}

async function replaySession(session) {
  const seed = await seedDescription(session);
  const runA = await runSession(session, { entry, workRoot: path.join(workRoot, 'a') });
  const runB = await runSession(session, {
    entry,
    workRoot: path.join(workRoot, 'b'),
    config: configPath,
  });
  const differences = compareRun(runA, {
    stdout: runB.stdout,
    stderr: runB.stderr,
    exitCode: runB.exitCode,
    produced: runB.produced,
  });
  const transcript = await readFile(fromRepo(session.transcript));
  const record = {
    name: session.name,
    note: session.note,
    transcript: session.transcript,
    transcriptSha256: sha256(transcript),
    seed,
    cwd: `fresh copy of the seed under <work>/{a,b}/${session.name}/run; scripts and logs stay outside`,
    a: streamRecord(runA),
    b: streamRecord(runB),
    identical: differences.length === 0,
    differences,
  };
  const lines = [
    `session: ${session.name} (${session.note})`,
    `transcript: ${session.transcript} sha256=${record.transcriptSha256}`,
    `seed: ${seed.kind} ${seed.path ?? ''} ${seed.sha256 ?? ''} ${seed.files.length ? `${seed.files.length} files` : ''}`.trimEnd(),
    `cwd: ${record.cwd}`,
    `A: exit=${runA.exitCode} stdout=${runA.stdout.length}B stderr=${runA.stderr.length}B`,
    `B: exit=${runB.exitCode} stdout=${runB.stdout.length}B stderr=${runB.stderr.length}B`,
    `files: ${record.a.files.map((file) => `${file.path}(${file.bytes}B, ${file.sha256.slice(0, 12)})`).join(', ') || '(none)'}`,
    `result: ${record.identical ? 'identical (stdout/stderr/exit/produced bytes)' : 'DIFFERENCES'}`,
  ];
  for (const difference of differences) lines.push(`  ${difference}`);
  lines.push('');
  return { record, lines, ok: record.identical };
}

async function runDefaultsCheck() {
  const runDirectory = path.join(workRoot, 'defaults', 'run');
  const run = await runSessionWithStdin(
    runDirectory,
    'init 200 100\nhelp\nstats\ndir\ncreate box b 1 2 3 4\ntree\n',
    ['--config', noPluginsConfig],
  );
  const stdout = run.stdout.toString('utf8');
  const lines = stdout.split('\n');
  const checks = [
    {
      name: 'help contains no optional commands',
      ok: !lines.some((line) => line.startsWith('dir ') || line.startsWith('stats ')),
    },
    {
      name: 'help contains no box shape type',
      ok: !lines.some((line) => line.startsWith('  box ')),
    },
    { name: 'unknown stats command', ok: stdout.includes('error: unknown command: stats') },
    { name: 'unknown dir command', ok: stdout.includes('error: unknown command: dir') },
    {
      name: 'unknown box shape',
      ok: stdout.includes('error: unknown shape type: box (is the plugin loaded?)'),
    },
    { name: 'error exit code', ok: run.exitCode === 1 },
  ];
  const baseline = [];
  for (const baselineSession of baselineSessions) {
    const golden = await readGolden(path.join(fromRepo(goldenRoot), baselineSession.name));
    const replay = await runSession(baselineSession, {
      entry,
      workRoot: path.join(workRoot, 'baseline'),
      config: noPluginsConfig,
    });
    const differences = compareRun(replay, golden);
    baseline.push({
      name: baselineSession.name,
      exitCode: replay.exitCode,
      stdoutBytes: replay.stdout.length,
      matched: differences.length === 0,
      differences,
    });
  }
  const matched = baseline.filter((session) => session.matched).length;
  const allChecks = checks.every((check) => check.ok) && matched === baseline.length;
  const logLines = [
    `config: ${POSIX(path.relative(repoRoot, noPluginsConfig))}`,
    '## defaults',
    ...checks.map((check) => `${check.ok ? 'PASS' : 'FAIL'} ${check.name}`),
    `stdout bytes: ${run.stdout.length}, exit: ${run.exitCode}`,
    '## Phase 1 golden with every optional plugin disabled',
    ...baseline.map(
      (session) =>
        `${session.matched ? 'ok  ' : 'diff'} ${session.name} exit=${session.exitCode} stdout=${session.stdoutBytes}B`,
    ),
    `baseline: ${matched}/${baseline.length} matched`,
    '',
  ];
  for (const session of baseline)
    for (const difference of session.differences) logLines.push(`  ${difference}`);
  return { checks, baseline, matched, total: baseline.length, allChecks, lines: logLines, stdout };
}

async function runSessionWithStdin(runDirectory, stdin, extraArgs = []) {
  await rm(runDirectory, { recursive: true, force: true });
  await mkdir(runDirectory, { recursive: true });
  const result = spawnSync(process.execPath, [entry, ...extraArgs], {
    cwd: runDirectory,
    input: Buffer.from(stdin, 'utf8'),
    encoding: 'buffer',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  if (result.error) throw result.error;
  return { exitCode: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/**
 * The same `init/help/tree` input through both roots proves the optional command and shape
 * registration set, order and options are identical: help lists commands in registration order
 * and shape types from the providers, so byte-identical help is an order-sensitive check.
 */
async function runHelpParity() {
  const stdin = 'init 200 100\nhelp\ntree\n';
  const a = await runSessionWithStdin(path.join(workRoot, 'help-parity', 'a'), stdin);
  const b = await runSessionWithStdin(path.join(workRoot, 'help-parity', 'b'), stdin, [
    '--config',
    configPath,
  ]);
  const identical =
    a.exitCode === b.exitCode && a.stdout.equals(b.stdout) && a.stderr.equals(b.stderr);
  const record = {
    input: stdin.trim().split('\n'),
    a: { exitCode: a.exitCode, stdoutBytes: a.stdout.length, stdoutSha256: sha256(a.stdout) },
    b: { exitCode: b.exitCode, stdoutBytes: b.stdout.length, stdoutSha256: sha256(b.stdout) },
    identical,
  };
  const lines = [
    'help parity: init/help/tree through both roots',
    `A: exit=${a.exitCode} stdout=${a.stdout.length}B sha256=${sha256(a.stdout)}`,
    `B: exit=${b.exitCode} stdout=${b.stdout.length}B sha256=${sha256(b.stdout)}`,
    `result: ${identical ? 'identical (registration set/order/options)' : 'DIFFERENCES'}`,
    '',
  ];
  return { record, lines, ok: identical };
}

await mkdir(outDirectory, { recursive: true });
const headAtRun = execFileSyncGit(['rev-parse', 'HEAD']).trim();
const heads = {
  atRun: headAtRun,
  measured: execFileSyncGit(['rev-parse', integration]).trim(),
  measuredRef: integration,
};
const sessionResults = [];
let failed = false;
for (const session of replaySessions) {
  const result = await replaySession(session);
  sessionResults.push(result.record);
  await writeFile(
    path.join(outDirectory, `ab-${session.name}.log`),
    `${result.lines.join('\n')}\n`,
  );
  if (!result.ok) failed = true;
}

const defaults = await runDefaultsCheck();
await writeFile(path.join(outDirectory, 'ab-no-plugins.log'), `${defaults.lines.join('\n')}\n`);
if (!defaults.allChecks) failed = true;

const helpParity = await runHelpParity();
await writeFile(path.join(outDirectory, 'ab-help.log'), `${helpParity.lines.join('\n')}\n`);
if (!helpParity.ok) failed = true;

const configJson = JSON.parse(await readFile(configPath, 'utf8'));
const compare = {
  generatedBy: `node scripts/assembly/replay.mjs --entry ${POSIX(path.relative(repoRoot, entry))} --config ${POSIX(path.relative(repoRoot, configPath))} --integration ${integration}`,
  mode: {
    a: 'default entry (embedded plugins in apps/cli/src/main.ts)',
    b: `same entry with --config ${POSIX(path.relative(repoRoot, configPath))}`,
  },
  pluginSet: {
    config: POSIX(path.relative(repoRoot, configPath)),
    modules: configJson.plugins.map((entryConfig) => entryConfig.module),
    options: configJson.plugins.map((entryConfig) => entryConfig.options ?? null),
    enabled: configJson.plugins.map((entryConfig) => entryConfig.enabled ?? true),
    note: 'A registers the same modules in the same order in apps/cli/src/main.ts; ab-help.log compares the resulting help bytes',
  },
  commits: {
    measured: heads.measured,
    measuredRef: heads.measuredRef,
    atRun: heads.atRun,
    note: 'measured commit is the integration commit under test; the node commit on top only adds scripts/docs/evidence',
  },
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  configSha256: sha256(await readFile(configPath)),
  sessions: sessionResults,
  helpParity: helpParity.record,
  noPlugins: {
    config: POSIX(path.relative(repoRoot, noPluginsConfig)),
    checks: defaults.checks,
    baseline: defaults.baseline,
    baselineMatched: defaults.matched,
    baselineTotal: defaults.total,
  },
  totals: {
    sessions: sessionResults.length,
    identical: sessionResults.filter((session) => session.identical).length,
    baselineMatched: defaults.matched,
    baselineTotal: defaults.total,
    helpParity: helpParity.ok,
  },
};
// Keep the committed JSON prettier-clean so the root format check sees no generated diff; the
// formatter comes from the locked devDependency and the fallback keeps the script runnable
// without dev tools.
const prettier = await import('prettier').catch(() => undefined);
const compareJson = JSON.stringify(compare, null, 2);
await writeFile(
  path.join(outDirectory, 'compare.json'),
  prettier === undefined
    ? `${compareJson}\n`
    : await prettier.format(compareJson, { parser: 'json', printWidth: 100 }),
);

for (const session of sessionResults) {
  console.log(
    `${session.identical ? 'ok  ' : 'diff'} ${session.name}: A exit=${session.a.exitCode} B exit=${session.b.exitCode} stdout=${session.a.stdoutBytes}B identical=${session.identical}`,
  );
}
console.log(`baseline with no optional plugins: ${defaults.matched}/${defaults.total} matched`);
console.log(`help parity A vs B: ${helpParity.ok ? 'identical' : 'DIFFERENCES'}`);
console.log(
  `compare.json written to ${POSIX(path.relative(repoRoot, outDirectory))}; measured ${heads.measured.slice(0, 7)}`,
);
if (failed) process.exitCode = 1;

function execFileSyncGit(args) {
  return spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).stdout ?? '';
}
