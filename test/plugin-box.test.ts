import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FakeFileStore, TreeDecoratorRegistry, TreePresenter } from '@svgframe/core';
import { createApplication } from '@svgframe/cli';
import boxPlugin, { BoxTypeLabelDecorator } from '@svgframe/shape-box';
import statsPlugin from '@svgframe/command-stats';
import dirPlugin from '@svgframe/command-dir';
import type { PluginModule, ReadonlyDocument } from '@svgframe/core';

const entry = resolve('apps/cli/dist/main.js');
const config = resolve('plugins.config.json');
const transcript = resolve('doc/transcript/box.txt');
const expected = resolve('test/fixtures/expected/box');
const fixtures = resolve('test/fixtures/svg');

function cli(args: readonly string[], input: string, cwd: string) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, input, encoding: 'utf8' });
}

function embedded(plugins: readonly PluginModule[]) {
  return plugins.map((plugin) => ({ module: plugin, manifest: plugin.manifest }));
}

function appWith(
  files: FakeFileStore,
  plugins: readonly PluginModule[] = [statsPlugin, dirPlugin, boxPlugin],
) {
  return createApplication({ files, embeddedPlugins: embedded(plugins) });
}

function treeLines(document: ReadonlyDocument): readonly string[] {
  const decorators = new TreeDecoratorRegistry();
  decorators.register(new BoxTypeLabelDecorator());
  return new TreePresenter(decorators).tree(document);
}

test('A and B expose the box type and stay byte-identical on the box session', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-box-ab-'));
  try {
    const input = [
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      'create box n2 520 100 160 60 "处理数据"',
      'create line arrow1 280 130 520 130 black',
      'group flowchart n1 n2 arrow1',
      'move n2 0 100',
      'undo',
      'set n2 fill #f5a623',
      'set n2 label "处理数据 v2"',
      'undo',
      'tree',
      'help',
      '',
    ].join('\n');
    const a = cli([], input, work);
    const b = cli(['--config', config], input, work);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(a.stdout, b.stdout, 'A and B must be byte-identical with box enabled');
    assert.equal(a.stderr, b.stderr);
    assert.match(a.stdout, /g#n1 \(box\)/);
    assert.match(a.stdout, /box#n2 fill propagated to n2-rect/);
    assert.match(a.stdout, /box#n2 label updated: "处理数据 v2"/);
    assert.match(a.stdout, /^ {2}box <id> <x> <y> <w> <h> "label"$/m, 'help Types lists box');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('the frozen box transcript replays byte-exactly with the box plugin', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-box-session-'));
  const configDirectory = resolve('artifacts/plugin-box-tests');
  try {
    // #19 froze these bytes with the stats/dir/box plugin set only; a later
    // decorator (tree-modified) would add row suffixes, so this replay pins the
    // historical plugin set instead of rewriting the frozen golden.
    await mkdir(configDirectory, { recursive: true });
    const boxOnlyConfig = join(configDirectory, 'box-only.json');
    await writeFile(
      boxOnlyConfig,
      `${JSON.stringify({
        plugins: [
          { module: '@svgframe/command-stats' },
          { module: '@svgframe/command-dir' },
          { module: '@svgframe/shape-box' },
        ],
      })}\n`,
    );
    const stdout = await readFile(join(expected, 'stdout.txt'));
    const exitCode = Number((await readFile(join(expected, 'exit-code.txt'), 'utf8')).trim());
    assert.equal(stdout.includes(13), false, 'expected output must use LF only');
    const result = spawnSync(
      process.execPath,
      [entry, '--script', transcript, '--config', boxOnlyConfig],
      { cwd: work, encoding: 'buffer' },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, exitCode);
    assert.equal(result.stderr.length, 0);
    assert.ok(
      result.stdout.equals(stdout),
      'box transcript output differs from the expected bytes',
    );
    const saved = await readFile(join(work, 'flowchart-box.svg'), 'utf8');
    assert.match(saved, /data-kind="box"/);
    for (const id of ['n1', 'n2', 'n1-rect', 'n1-label', 'n2-rect', 'n2-label', 'arrow1'])
      assert.match(saved, new RegExp(`id="${id}"`));
  } finally {
    await rm(work, { recursive: true, force: true });
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test('read-back restores complete boxes, extra children, nested boxes and transforms once', async () => {
  const files = new FakeFileStore();
  files.files.set('box-roundtrip.svg', await readFile(join(fixtures, 'box-roundtrip.svg'), 'utf8'));
  const application = await appWith(files);
  assert.deepEqual(await application.dispatcher.execute('read box-roundtrip.svg'), [
    'read box-roundtrip.svg (8 elements)',
  ]);
  const document = application.session.document();
  assert.equal(document.require('n1').kind, 'box');
  assert.equal(document.require('n2').kind, 'box');
  assert.deepEqual(document.require('n1-rect').geometry(), {
    x: '10',
    y: '20',
    width: '160',
    height: '60',
  });
  assert.deepEqual(document.require('n1-label').geometry(), { x: '30', y: '55' });
  assert.equal(document.require('n1-label').textContent(), '开始');
  assert.deepEqual(document.require('n2-rect').geometry(), {
    x: '210',
    y: '20',
    width: '80',
    height: '30',
  });
  assert.equal(document.require('n1-extra').tag, 'rect');
  const lines = treeLines(document);
  assert.equal(lines[2], '    └── g#n1 (box)');
  assert.ok(lines.some((line) => line.endsWith('g#n2 (box)')));
  await application.session.save('roundtrip-1.svg');
  await application.session.save('roundtrip-2.svg');
  const first = files.files.get('roundtrip-1.svg');
  assert.equal(files.files.get('roundtrip-2.svg'), first, 'encode/decode stays byte stable');
  assert.match(first!, /data-kind="box"/);
  assert.match(first!, /<rect id="n1-rect" x="10" y="20" width="160" height="60"/);
});

test('broken box structures reject the whole read and keep the previous document and history', async () => {
  const cases: readonly [string, RegExp][] = [
    ['box-missing-part.svg', /^error: incomplete box: n1 is missing n1-label$/],
    ['box-wrong-kind.svg', /^error: invalid box: n1-label must be a <text> part$/],
    ['box-duplicate-id.svg', /^error: id already exists: n1-rect$/],
  ];
  for (const [fixture, error] of cases) {
    const files = new FakeFileStore();
    files.files.set(fixture, await readFile(join(fixtures, fixture), 'utf8'));
    const application = await appWith(files);
    await application.dispatcher.execute('init 800 600');
    await application.dispatcher.execute('create circle keep 1 2 3');
    const result = await application.dispatcher.execute(`read ${fixture}`);
    assert.equal(result.length, 1, fixture);
    assert.match(result[0]!, error, fixture);
    assert.deepEqual(
      application.session
        .document()
        .all()
        .map((shape) => shape.id),
      ['keep'],
      `${fixture}: failed read keeps the old document`,
    );
    assert.deepEqual(await application.dispatcher.execute('undo'), ['undone: circle#keep created']);
    assert.equal(application.session.document().all().length, 0);
  }
});

test('without the box provider the same document degrades to g and keeps data-kind', async () => {
  const files = new FakeFileStore();
  files.files.set('box-degraded.svg', await readFile(join(fixtures, 'box-degraded.svg'), 'utf8'));
  const application = await appWith(files, [statsPlugin, dirPlugin]);
  assert.deepEqual(await application.dispatcher.execute('read box-degraded.svg'), [
    'read box-degraded.svg (3 elements)',
  ]);
  assert.equal(application.session.document().require('n1').kind, 'g');
  assert.deepEqual(await application.dispatcher.execute('create box b1 1 2 3 4 "x"'), [
    'error: unknown shape type: box (is the plugin loaded?)',
  ]);
  assert.equal(
    (await application.dispatcher.help()).some((line) => line.trim().startsWith('box <id>')),
    false,
  );
  await application.session.save('degraded.svg');
  const encoded = files.files.get('degraded.svg')!;
  assert.match(encoded, /<g id="n1" data-kind="box">/);
});

test('a disabled box entry keeps help and create quiet and degrades on read', async () => {
  const configDirectory = resolve('artifacts/plugin-box-tests');
  const work = await mkdtemp(join(tmpdir(), 'svg-box-off-'));
  try {
    await mkdir(configDirectory, { recursive: true });
    const disabledConfig = join(configDirectory, 'disabled.json');
    await writeFile(
      disabledConfig,
      `${JSON.stringify({
        plugins: [
          { module: '@svgframe/command-stats' },
          { module: '@svgframe/command-dir' },
          { module: '@svgframe/shape-box', enabled: false },
        ],
      })}\n`,
    );
    const result = cli(
      ['--config', disabledConfig],
      'init 800 600\nhelp\ncreate box b1 1 2 3 4 "x"\n',
      work,
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^error: unknown shape type: box \(is the plugin loaded\?\)$/m);
    assert.equal(
      result.stdout.split('\n').some((line) => line.trim().startsWith('box <id>')),
      false,
    );
    const files = new FakeFileStore();
    files.files.set(
      'box-roundtrip.svg',
      await readFile(join(fixtures, 'box-roundtrip.svg'), 'utf8'),
    );
    const application = await createApplication({
      files,
      embeddedPlugins: embedded([statsPlugin, dirPlugin]),
      configPath: disabledConfig,
    });
    assert.deepEqual(await application.dispatcher.execute('read box-roundtrip.svg'), [
      'read box-roundtrip.svg (8 elements)',
    ]);
    assert.equal(application.session.document().require('n1').kind, 'g');
  } finally {
    await rm(work, { recursive: true, force: true });
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test('normal commands protect necessary parts, allow whole delete and undo, and report box wording', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-box-structure-'));
  try {
    const input = [
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      'create rect extra 0 0 5 5 in n1',
      'delete n1-rect',
      'addto n1 n1-rect',
      'group bad n1-rect',
      'ungroup n1',
      'delete extra',
      'delete n1',
      'undo',
      'tree',
      'init 800 600',
      'create rect n1-rect 0 0 1 1',
      'create box n1 1 2 3 4 "title"',
      'tree',
      '',
    ].join('\n');
    const result = cli(['--config', config], input, work);
    assert.equal(result.status, 1, 'the session contains expected errors');
    const lines = result.stdout.split('\n');
    for (const expected of [
      'error: cannot remove necessary part: n1-rect',
      'error: cannot move necessary part: n1-rect',
      'error: cannot ungroup composite shape: n1',
      'rect#extra deleted',
      'box#n1 deleted',
      'undone: box#n1 deleted',
      'error: id already exists: n1-rect',
    ])
      assert.ok(lines.includes(expected), `missing output line ${JSON.stringify(expected)}`);
    assert.ok(lines.some((line) => line.includes('g#n1 (box)')));
    const firstTreeStart = result.stdout.indexOf('svg (800x600)');
    const firstTreeEnd = result.stdout.indexOf('svg (800x600)', firstTreeStart + 1);
    const firstTree = result.stdout.slice(firstTreeStart, firstTreeEnd);
    assert.equal(firstTree.includes('rect#extra'), false, 'undo removed the extra child');
    assert.equal(
      lines.filter((line) => line === 'error: unknown shape type: box (is the plugin loaded?)')
        .length,
      0,
    );
    const secondTree = result.stdout.slice(result.stdout.lastIndexOf('svg (800x600)'));
    assert.ok(secondTree.includes('rect#n1-rect'));
    assert.equal(secondTree.includes('g#n1 (box)'), false, 'the conflicting box was not created');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
