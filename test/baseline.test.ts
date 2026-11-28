import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const goldenRoot = path.join(root, 'test', 'fixtures', 'expected', 'baseline-final');
const transcriptRoot = path.join(root, 'doc', 'transcript');
const sessions = ['basic', 'flowchart', 'io', 'dir'] as const;
const exitCodes: Record<(typeof sessions)[number], number> = {
  basic: 1,
  flowchart: 0,
  io: 1,
  dir: 1,
};
const phaseOneCommands = new Set([
  'init',
  'read',
  'save',
  'canvas',
  'create',
  'delete',
  'move',
  'scale',
  'set',
  'group',
  'ungroup',
  'addto',
  'front',
  'back',
  'tree',
  'show',
  'undo',
  'redo',
  'help',
]);

function assertLfOnly(buffer: Buffer, label: string): void {
  assert.equal(buffer.includes(13), false, `${label}: golden must use LF only, no CRLF`);
}

function assertNoMachinePath(text: string, label: string): void {
  assert.doesNotMatch(
    text,
    /(?:^|[\r\n])[A-Za-z]:\\/,
    `${label}: contains a Windows absolute path`,
  );
  assert.doesNotMatch(
    text,
    /(?:^|[\r\n])\/(?:home|Users|tmp)\//,
    `${label}: contains a POSIX absolute path`,
  );
}

async function walk(directory: string, prefix = ''): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      found.push(...(await walk(path.join(directory, entry.name), relative)));
    else found.push(relative);
  }
  return found.sort();
}

async function walkEntries(
  directory: string,
  prefix = '',
): Promise<{ path: string; type: 'file' | 'directory' }[]> {
  const found: { path: string; type: 'file' | 'directory' }[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push({ path: relative, type: 'directory' });
      found.push(...(await walkEntries(path.join(directory, entry.name), relative)));
    } else {
      found.push({ path: relative, type: 'file' });
    }
  }
  return found;
}

function parseManifest(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    assert.ok(match, `malformed files.sha256 line: ${JSON.stringify(line)}`);
    entries.set(match[2]!, match[1]!);
  }
  return entries;
}

test('baseline golden: four sessions are complete, LF-only and machine independent', async () => {
  for (const session of sessions) {
    const directory = path.join(goldenRoot, session);
    const stdout = await readFile(path.join(directory, 'stdout.txt'));
    const stderr = await readFile(path.join(directory, 'stderr.txt'));
    const exitText = await readFile(path.join(directory, 'exit-code.txt'), 'utf8');
    assertLfOnly(stdout, `${session}/stdout.txt`);
    assertLfOnly(stderr, `${session}/stderr.txt`);
    assertNoMachinePath(stdout.toString('utf8'), `${session}/stdout.txt`);
    assertNoMachinePath(stderr.toString('utf8'), `${session}/stderr.txt`);
    assert.equal(Number.parseInt(exitText.trim(), 10), exitCodes[session], `${session}: exit code`);
    const expected = parseManifest(await readFile(path.join(directory, 'files.sha256'), 'utf8'));
    const filesRoot = path.join(directory, 'files');
    const produced = existsSync(filesRoot) || expected.size ? await walk(filesRoot) : [];
    assert.deepEqual([...expected.keys()].sort(), produced, `${session}: manifest paths`);
    for (const relative of produced) {
      const content = await readFile(path.join(directory, 'files', relative));
      assertLfOnly(content, `${session}/files/${relative}`);
      assert.equal(
        createHash('sha256').update(content).digest('hex'),
        expected.get(relative),
        `${session}/files/${relative}: manifest hash`,
      );
    }
  }
  assert.equal(
    await readFile(path.join(goldenRoot, 'dir', 'stdout.txt'), 'utf8'),
    'canvas 200x100 created\nerror: unknown command: dir\nsvg (200x100)\n',
    'dir without the Phase 2 plugin must stay at the Phase 1 unknown-command fallback',
  );
});

test('baseline golden: provenance pins the final tag object and its dereferenced commit', async () => {
  const provenance = JSON.parse(
    await readFile(path.join(goldenRoot, 'provenance.json'), 'utf8'),
  ) as { tagObject?: string; commit?: string; node?: string; installMethod?: string };
  assert.match(provenance.tagObject ?? '', /^[0-9a-f]{40}$/, 'tag object SHA');
  assert.match(provenance.commit ?? '', /^[0-9a-f]{40}$/, 'dereferenced commit SHA');
  assert.notEqual(
    provenance.tagObject,
    provenance.commit,
    'annotated tag object is not the commit',
  );
  assert.match(provenance.node ?? '', /^v\d+\.\d+\.\d+$/, 'recorded node version');
  assert.ok((provenance.installMethod ?? '').length > 0, 'install method must be recorded');
});

test('baseline transcripts: commands and comments only, no prompts or expected output', async () => {
  for (const session of sessions) {
    const file = path.join(transcriptRoot, `baseline-${session}.txt`);
    const buffer = await readFile(file);
    assertLfOnly(buffer, `doc/transcript/baseline-${session}.txt`);
    assert.equal(
      buffer[0] === 0xef && buffer[1] === 0xbb,
      false,
      'transcript must not start with a BOM',
    );
    const text = buffer.toString('utf8');
    assertNoMachinePath(text, `doc/transcript/baseline-${session}.txt`);
    assert.doesNotMatch(text, /^\s*svg>/m, 'transcript must not contain a prompt');
    assert.doesNotMatch(text, /svg-editor \d/m, 'transcript must not contain the banner');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const command = trimmed.split(/\s+/)[0]!;
      assert.ok(
        phaseOneCommands.has(command) || command === 'dir',
        `${session}: unexpected command ${JSON.stringify(command)} in transcript`,
      );
    }
  }
});

test('dir fixture: committed tree matches its rebuild inventory', async () => {
  const directory = path.join(root, 'test', 'fixtures', 'dir');
  const inventory = JSON.parse(await readFile(path.join(directory, 'inventory.json'), 'utf8')) as {
    root: string;
    entries: { path: string; type: 'file' | 'directory'; sha256?: string }[];
  };
  const expected = new Map(inventory.entries.map((entry) => [entry.path, entry]));
  const tree = path.join(root, 'test', 'fixtures', 'dir', 'tree');
  const entries = await walkEntries(tree);
  assert.deepEqual(
    entries.map((entry) => entry.path).sort(),
    [...expected.keys()].sort(),
    'inventory paths must match the fixture tree',
  );
  for (const entry of entries) {
    const known = expected.get(entry.path);
    assert.ok(known, `${entry.path}: missing inventory entry`);
    assert.equal(known.type, entry.type, `${entry.path}: type`);
    if (entry.type === 'directory') continue;
    const content = await readFile(path.join(tree, entry.path));
    assert.equal(
      known.sha256,
      createHash('sha256').update(content).digest('hex'),
      `${entry.path}: sha256`,
    );
  }
  const found = entries.filter((entry) => entry.type === 'file').map((entry) => entry.path);
  for (const name of ['.hidden', '中文名.txt', 'with space.txt', 'Zeta.md', 'alpha.txt']) {
    assert.ok(found.includes(name), `dir fixture must keep ${name}`);
  }
});

test('compare entry: pair mode detects byte differences with context', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'svg-baseline-pair-'));
  try {
    const expected = path.join(work, 'expected');
    const actual = path.join(work, 'actual');
    for (const directory of [expected, actual]) {
      await mkdir(path.join(directory, 'files'), { recursive: true });
      await writeFile(path.join(directory, 'stdout.txt'), 'a\nb\n');
      await writeFile(path.join(directory, 'stderr.txt'), '');
      await writeFile(path.join(directory, 'exit-code.txt'), '1\n');
      await writeFile(path.join(directory, 'files', 'made.svg'), '<svg/>\n');
    }
    const compare = path.join(root, 'scripts', 'baseline', 'compare.mjs');
    const same = spawnSync(process.execPath, [compare, '--pair', expected, actual], {
      encoding: 'utf8',
    });
    assert.equal(same.status, 0, same.stdout + same.stderr);
    assert.match(same.stdout, /^ok {4}/m);
    await writeFile(path.join(actual, 'stdout.txt'), 'a\nB\n');
    const different = spawnSync(process.execPath, [compare, '--pair', expected, actual], {
      encoding: 'utf8',
    });
    assert.equal(different.status, 1, different.stdout + different.stderr);
    assert.match(different.stdout, /^diff {2}/m);
    assert.match(different.stdout, /stdout: expected 4 bytes, actual 4 bytes/);
    assert.match(different.stdout, /"b"/);
    assert.match(different.stdout, /"B"/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('phase 1 golden replays byte-exactly against the current build', async (t) => {
  const entry = path.join(root, 'apps', 'cli', 'dist', 'main.js');
  if (!existsSync(entry)) {
    t.skip('apps/cli/dist/main.js is not built (run npm test through the root script)');
    return;
  }
  const work = await mkdtemp(path.join(tmpdir(), 'svg-baseline-replay-'));
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(root, 'scripts', 'baseline', 'compare.mjs'), '--entry', entry, '--work', work],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /4 sessions, 4 matched, 0 differed/);
    assert.match(result.stdout, /ok {4}dir .*exit=1/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
