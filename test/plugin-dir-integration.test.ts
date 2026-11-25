import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FakeFileStore } from '@svgframe/core';
import { LocalDirectoryReader } from '@svgframe/host';
import { createApplication } from '@svgframe/cli';
import dirPlugin from '@svgframe/command-dir';
import type { EditorSessionPort, PluginModule, ReadonlyShape } from '@svgframe/core';

const entry = resolve('apps/cli/dist/main.js');
const config = resolve('plugins.config.json');
const fixture = resolve('test/fixtures/dir/tree');
const fixtureListing = [
  '[DIR]  sub-one',
  '[DIR]  sub-two',
  '[FILE]  .hidden',
  '[FILE]  Zeta.md',
  '[FILE]  alpha.txt',
  '[FILE]  with space.txt',
  '[FILE]  中文名.txt',
];

function cli(args: readonly string[], input: string, cwd: string) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, input, encoding: 'utf8' });
}

function embedded(plugins: readonly PluginModule[]) {
  return plugins.map((plugin) => ({ module: plugin, manifest: plugin.manifest }));
}

function listing(reader: LocalDirectoryReader, plugins: readonly PluginModule[] = [dirPlugin]) {
  return createApplication({
    files: new FakeFileStore(),
    directories: reader,
    embeddedPlugins: embedded(plugins),
  });
}

function documentOutline(session: EditorSessionPort): string {
  const rows: string[] = [];
  const visit = (shape: ReadonlyShape, depth: number): void => {
    rows.push(`${'  '.repeat(depth)}${shape.tag}#${shape.id}[${shape.kind}]`);
    shape.children().forEach((child) => visit(child, depth + 1));
  };
  session
    .document()
    .root.children()
    .forEach((child) => visit(child, 0));
  rows.push(`canvas ${session.document().width}x${session.document().height}`);
  return rows.join('\n');
}

test('the real adapter lists a temp directory with Chinese names, spaces, hidden entries and no recursion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'svg-dir-real-'));
  const listed = join(root, 'listed');
  try {
    await mkdir(join(listed, 'sub-one'), { recursive: true });
    await writeFile(join(listed, 'sub-one', 'placeholder.txt'), 'nested\n');
    await mkdir(join(listed, '中文 目录'));
    await writeFile(join(listed, '.hidden'), 'hidden\n');
    await writeFile(join(listed, 'Zeta.md'), 'z\n');
    await writeFile(join(listed, 'alpha.txt'), 'a\n');
    await writeFile(join(listed, 'with space.txt'), 's\n');
    const reader = new LocalDirectoryReader(() => listed);
    const application = await listing(reader);
    assert.deepEqual(await application.dispatcher.execute('dir'), [
      '[DIR]  sub-one',
      '[DIR]  中文 目录',
      '[FILE]  .hidden',
      '[FILE]  Zeta.md',
      '[FILE]  alpha.txt',
      '[FILE]  with space.txt',
    ]);
    assert.equal(reader.cwd(), listed, 'the adapter cwd is the injected working directory');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a symbolic link is reported as [LINK] and its target is not listed', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'svg-dir-link-'));
  const listed = join(root, 'listed');
  try {
    await mkdir(listed);
    await writeFile(join(listed, 'alpha.txt'), 'a\n');
    try {
      await symlink(join(listed, 'alpha.txt'), join(listed, 'alias'));
    } catch {
      t.diagnostic('symlink creation is not permitted in this environment');
      return;
    }
    const application = await listing(new LocalDirectoryReader(() => listed));
    assert.deepEqual(await application.dispatcher.execute('dir'), [
      '[FILE]  alpha.txt',
      '[LINK]  alias',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an empty real directory prints (empty directory)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'svg-dir-empty-'));
  try {
    const listed = join(root, 'listed');
    await mkdir(listed);
    const application = await listing(new LocalDirectoryReader(() => listed));
    assert.deepEqual(await application.dispatcher.execute('dir'), ['(empty directory)']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a real read failure keeps the adapter wording and later commands still run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'svg-dir-fail-'));
  try {
    const missing = join(root, 'missing');
    const application = await listing(new LocalDirectoryReader(() => missing));
    assert.deepEqual(await application.dispatcher.execute('dir'), [
      `error: cannot read directory: ${missing}`,
    ]);
    assert.deepEqual(await application.dispatcher.execute('init 400 300'), [
      'canvas 400x300 created',
    ]);
    assert.deepEqual(await application.dispatcher.execute('dir'), [
      `error: cannot read directory: ${missing}`,
    ]);
    assert.deepEqual(await application.dispatcher.execute('undo'), [
      'error: undo not allowed after io command',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('dir works without a document and does not change cwd, documents or the redo branch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'svg-dir-state-'));
  const workingDirectory = process.cwd();
  try {
    const listed = join(root, 'listed');
    await mkdir(listed);
    await writeFile(join(listed, 'alpha.txt'), 'a\n');
    const reader = new LocalDirectoryReader(() => listed);
    const application = await listing(reader);
    assert.deepEqual(await application.dispatcher.execute('dir'), ['[FILE]  alpha.txt']);
    assert.equal(application.session.hasDocument(), false);
    await application.dispatcher.execute('init 400 300');
    await application.dispatcher.execute('create circle c 1 2 3');
    await application.dispatcher.execute('undo');
    const before = documentOutline(application.session);
    await application.dispatcher.execute('dir');
    assert.equal(documentOutline(application.session), before);
    assert.deepEqual(await application.dispatcher.execute('redo'), ['redone: circle#c created']);
    assert.equal(application.session.document().all().length, 1);
    const files = new FakeFileStore();
    files.files.set('existing.svg', '<svg width="10" height="10"/>');
    const withFiles = await createApplication({
      files,
      directories: reader,
      embeddedPlugins: embedded([dirPlugin]),
    });
    await withFiles.dispatcher.execute('read existing.svg');
    await withFiles.dispatcher.execute('save copy.svg');
    assert.deepEqual(await withFiles.dispatcher.execute('dir'), ['[FILE]  alpha.txt']);
    assert.equal(reader.cwd(), listed, 'read/save keep the directory reader cwd');
    assert.equal(process.cwd(), workingDirectory, 'no test or command calls process.chdir');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('A and B are byte-identical on the frozen directory fixture and list stats before dir', async () => {
  const input = ['init 400 300', 'create rect r 1 2 3 4', 'stats', 'dir', 'help', ''].join('\n');
  const a = cli([], input, fixture);
  const b = cli(['--config', config], input, fixture);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.equal(a.stdout, b.stdout, 'A and B must be byte-identical on the same directory');
  assert.equal(a.stderr, b.stderr);
  assert.ok(a.stdout.includes(fixtureListing.join('\n')), 'dir lists the frozen fixture in order');
  const statsAt = a.stdout.indexOf('\nstats\n');
  const dirAt = a.stdout.indexOf('\ndir\n');
  assert.ok(statsAt >= 0 && dirAt >= 0, 'help lists both optional commands');
  assert.ok(statsAt < dirAt, 'help follows plugins.config.json and registration order');
});

test('dir without a document works in the real CLI and exits successfully', () => {
  const result = cli([], 'dir\n', fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${fixtureListing.join('\n')}\n`);
});

test('a disabled dir entry keeps help quiet and reports unknown command', async () => {
  const configDirectory = resolve('artifacts/plugin-dir-tests');
  try {
    await mkdir(configDirectory, { recursive: true });
    const disabledConfig = join(configDirectory, 'disabled.json');
    await writeFile(
      disabledConfig,
      `${JSON.stringify({
        plugins: [
          { module: '@svgframe/command-stats' },
          { module: '@svgframe/command-dir', enabled: false },
        ],
      })}\n`,
    );
    const result = cli(['--config', disabledConfig], 'dir\nhelp\n', fixture);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^error: unknown command: dir$/m);
    const lines = result.stdout.split('\n').map((line) => line.trim());
    assert.equal(
      lines.filter((line) => line === 'dir').length,
      0,
      'disabled dir adds no help line',
    );
    assert.equal(lines.filter((line) => line === 'stats').length, 1, 'stats stays enabled');
    const application = await createApplication({
      files: new FakeFileStore(),
      directories: new LocalDirectoryReader(() => fixture),
      configPath: disabledConfig,
    });
    assert.equal(application.commands.has('dir'), false);
    assert.deepEqual(await application.dispatcher.execute('dir'), ['error: unknown command: dir']);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});
