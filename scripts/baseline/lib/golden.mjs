import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STDOUT = 'stdout.txt';
export const STDERR = 'stderr.txt';
export const EXIT_CODE = 'exit-code.txt';
export const FILES = 'files';
export const MANIFEST = 'files.sha256';

function endsWithNewline(buffer) {
  return buffer.length > 0 && buffer[buffer.length - 1] === 10;
}

function displayLine(text) {
  return JSON.stringify(text);
}

/** Human readable diff for two byte buffers: byte counts, first difference, context lines. */
export function describeDifference(label, expected, actual) {
  const header = `${label}: expected ${expected.length} bytes, actual ${actual.length} bytes`;
  if (expected.equals(actual)) return [header];
  const expectedText = expected.toString('utf8');
  const actualText = actual.toString('utf8');
  const expectedLines = expectedText.split('\n');
  const actualLines = actualText.split('\n');
  if (endsWithNewline(expected)) expectedLines.pop();
  if (endsWithNewline(actual)) actualLines.pop();
  let first = 0;
  while (first < expectedLines.length && first < actualLines.length) {
    if (expectedLines[first] !== actualLines[first]) break;
    first++;
  }
  const lines = [header];
  if (endsWithNewline(expected) !== endsWithNewline(actual)) {
    lines.push(
      `  trailing newline differs: expected ${endsWithNewline(expected)}, actual ${endsWithNewline(actual)}`,
    );
  }
  lines.push(`  first differing line: ${first + 1}`);
  const start = Math.max(0, first - 3);
  const stop = Math.min(Math.max(expectedLines.length, actualLines.length), first + 4);
  for (let index = start; index < stop; index++) {
    const wanted = expectedLines[index];
    const got = actualLines[index];
    const number = String(index + 1).padStart(3, ' ');
    if (wanted === got) {
      lines.push(`  ${number}   ${wanted === undefined ? '<missing>' : displayLine(wanted)}`);
    } else {
      lines.push(`  ${number} - ${wanted === undefined ? '<missing line>' : displayLine(wanted)}`);
      lines.push(`  ${number} + ${got === undefined ? '<missing line>' : displayLine(got)}`);
    }
  }
  return lines;
}

export function manifestText(produced) {
  const rows = [...produced.entries()]
    .map(
      ([relative, content]) => `${createHash('sha256').update(content).digest('hex')}  ${relative}`,
    )
    .sort();
  return `${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

export async function writeGolden(sessionDirectory, run) {
  await rm(sessionDirectory, { recursive: true, force: true });
  await mkdir(path.join(sessionDirectory, FILES), { recursive: true });
  await writeFile(path.join(sessionDirectory, STDOUT), run.stdout);
  await writeFile(path.join(sessionDirectory, STDERR), run.stderr);
  await writeFile(path.join(sessionDirectory, EXIT_CODE), `${run.exitCode}\n`);
  for (const [relative, content] of run.produced) {
    const destination = path.join(sessionDirectory, FILES, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  await writeFile(path.join(sessionDirectory, MANIFEST), manifestText(run.produced));
}

async function walk(directory, prefix) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      found.push(...(await walk(path.join(directory, entry.name), relative)));
    else found.push(relative);
  }
  return found.sort();
}

export async function readGolden(sessionDirectory) {
  const produced = new Map();
  const filesRoot = path.join(sessionDirectory, FILES);
  for (const relative of await walk(filesRoot, '')) {
    produced.set(relative, await readFile(path.join(filesRoot, relative)));
  }
  const exitText = await readFile(path.join(sessionDirectory, EXIT_CODE), 'utf8');
  return {
    stdout: await readFile(path.join(sessionDirectory, STDOUT)),
    stderr: await readFile(path.join(sessionDirectory, STDERR)),
    exitCode: Number.parseInt(exitText.trim(), 10),
    produced,
  };
}

/**
 * Compare one recorded run with its golden copy. Returns a list of human readable differences;
 * an empty list means byte identical stdout, stderr, exit code and saved artifacts.
 */
export function compareRun(run, golden) {
  const differences = [];
  if (run.exitCode !== golden.exitCode) {
    differences.push(`exit code: expected ${golden.exitCode}, actual ${run.exitCode}`);
  }
  for (const [label, wanted, got] of [
    ['stdout', golden.stdout, run.stdout],
    ['stderr', golden.stderr, run.stderr],
  ]) {
    if (!wanted.equals(got)) differences.push(...describeDifference(label, wanted, got));
  }
  for (const [relative, wanted] of golden.produced) {
    const got = run.produced.get(relative);
    if (got === undefined) {
      differences.push(`file ${relative}: expected ${wanted.length} bytes, missing after replay`);
      continue;
    }
    if (!wanted.equals(got))
      differences.push(...describeDifference(`file ${relative}`, wanted, got));
  }
  for (const relative of run.produced.keys()) {
    if (!golden.produced.has(relative)) {
      differences.push(`file ${relative}: unexpected output file produced by replay`);
    }
  }
  for (const relative of run.removed ?? []) {
    differences.push(`file ${relative}: removed by replay`);
  }
  return differences;
}
