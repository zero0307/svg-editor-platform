import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

export function fromRepo(target) {
  return path.isAbsolute(target) ? target : path.join(repoRoot, target);
}

async function walk(directory, prefix) {
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(absolute, relative)));
    else found.push(relative);
  }
  return found.sort();
}

/** Hash every regular file below `directory`, keyed by POSIX-style relative path. */
export async function snapshotDirectory(directory) {
  const snapshot = new Map();
  for (const relative of await walk(directory, '')) {
    const content = await readFile(path.join(directory, relative));
    snapshot.set(relative, createHash('sha256').update(content).digest('hex'));
  }
  return snapshot;
}

async function seedRunDirectory(session, runDirectory) {
  await rm(runDirectory, { recursive: true, force: true });
  if (session.seedTree) {
    await cp(fromRepo(session.seedTree), runDirectory, { recursive: true });
  } else {
    await mkdir(runDirectory, { recursive: true });
  }
  for (const file of session.seedFiles ?? []) {
    await cp(fromRepo(file), path.join(runDirectory, path.basename(file)));
  }
}

/**
 * Run one frozen transcript against `entry` inside a disposable copy of its fixtures.
 * `entry` is the compiled CLI bootstrap; the transcript path is absolute and never echoed by
 * the CLI, so captured bytes stay platform independent.
 */
export async function runSession(session, { entry, workRoot }) {
  const runDirectory = path.join(workRoot, session.name, 'run');
  await seedRunDirectory(session, runDirectory);
  const before = await snapshotDirectory(runDirectory);
  const transcript = fromRepo(session.transcript);
  const result = spawnSync(process.execPath, [entry, '--script', transcript], {
    cwd: runDirectory,
    encoding: 'buffer',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  if (result.error) throw result.error;
  const after = await snapshotDirectory(runDirectory);
  const produced = new Map();
  for (const [relative, hash] of after) {
    if (before.get(relative) === hash) continue;
    produced.set(relative, await readFile(path.join(runDirectory, relative)));
  }
  const removed = [...before.keys()].filter((relative) => !after.has(relative));
  return {
    name: session.name,
    runDirectory,
    exitCode: result.status ?? -1,
    signal: result.signal ?? null,
    stdout: result.stdout,
    stderr: result.stderr,
    produced,
    removed,
  };
}
