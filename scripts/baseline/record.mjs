import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fromRepo, repoRoot, runSession } from './lib/runner.mjs';
import { goldenRoot as defaultGoldenRoot, sessions } from './sessions.mjs';
import { EXIT_CODE, FILES, MANIFEST, STDOUT, STDERR, writeGolden } from './lib/golden.mjs';

function value(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const argv = process.argv.slice(2);
const entry = value(argv, '--entry');
const tag = value(argv, '--tag');
const installMethod = value(argv, '--install-method') ?? 'unspecified';
const workRoot = fromRepo(value(argv, '--work') ?? 'artifacts/baseline');
const goldenRoot = fromRepo(value(argv, '--golden') ?? defaultGoldenRoot);
const evidenceDirectory = value(argv, '--evidence');

if (!entry || !argv.includes('--update')) {
  console.error(
    'usage: node scripts/baseline/record.mjs --entry <compiled-cli.js> --update [--tag final] [--work <dir>] [--golden <dir>] [--evidence <dir>] [--install-method <text>]',
  );
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
}

function provenance() {
  const details = {
    label: tag ? `${tag}^{commit}` : path.relative(repoRoot, fromRepo(entry)),
    tagObject: null,
    commit: null,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    installMethod,
    generatedBy: `node scripts/baseline/record.mjs ${argv.join(' ')}`,
  };
  if (tag) {
    try {
      details.tagObject = git('rev-parse', tag);
      details.commit = git('rev-parse', `${tag}^{commit}`);
    } catch {
      details.tagObject = null;
      details.commit = null;
    }
  }
  return details;
}

async function main() {
  const resolvedEntry = fromRepo(entry);
  const details = provenance();
  if (tag && (!details.tagObject || !details.commit)) {
    throw new Error(`cannot resolve tag ${tag} in ${repoRoot}`);
  }
  await rm(goldenRoot, { recursive: true, force: true });
  await mkdir(workRoot, { recursive: true });
  const recorded = [];
  for (const session of sessions) {
    const run = await runSession(session, { entry: resolvedEntry, workRoot });
    const sessionDirectory = path.join(goldenRoot, session.name);
    await writeGolden(sessionDirectory, run);
    recorded.push({
      name: session.name,
      transcript: session.transcript,
      exitCode: run.exitCode,
      stdoutBytes: run.stdout.length,
      stderrBytes: run.stderr.length,
      files: [...run.produced.keys()],
      goldenSha256: createHash('sha256')
        .update(run.stdout)
        .update(run.stderr)
        .update(String(run.exitCode))
        .digest('hex'),
    });
    console.log(
      `recorded ${session.name}: exit=${run.exitCode} stdout=${run.stdout.length}B stderr=${run.stderr.length}B files=[${[...run.produced.keys()].join(', ')}]`,
    );
  }
  await writeFile(
    path.join(goldenRoot, 'provenance.json'),
    `${JSON.stringify(
      {
        ...details,
        sessions: recorded,
        goldenLayout: {
          stdout: STDOUT,
          stderr: STDERR,
          exit: EXIT_CODE,
          files: FILES,
          manifest: MANIFEST,
        },
      },
      null,
      2,
    )}\n`,
  );
  if (evidenceDirectory) {
    const target = fromRepo(evidenceDirectory);
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await writeFile(
      path.join(target, 'record.json'),
      `${JSON.stringify(
        {
          ...details,
          generatedAt: new Date().toISOString(),
          entry: path.relative(repoRoot, resolvedEntry).split(path.sep).join('/'),
          workRoot: path.relative(repoRoot, workRoot).split(path.sep).join('/'),
          goldenRoot: path.relative(repoRoot, goldenRoot).split(path.sep).join('/'),
          sessions: recorded,
        },
        null,
        2,
      )}\n`,
    );
  }
  console.log(`golden written to ${path.relative(repoRoot, goldenRoot)} (node ${process.version})`);
}

await main();
