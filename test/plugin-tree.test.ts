import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FakeFileStore } from '@svgframe/core';
import { createApplication } from '@svgframe/cli';
import boxPlugin from '@svgframe/shape-box';
import treeModifiedPlugin from '@svgframe/tree-modified';
import statsPlugin from '@svgframe/command-stats';
import dirPlugin from '@svgframe/command-dir';
import type { PluginModule } from '@svgframe/core';

const entry = resolve('apps/cli/dist/main.js');
const config = resolve('plugins.config.json');

const CLEAN_BOX_TREE = [
  'svg (800x600)',
  '└── g#n1 (box)',
  '    ├── rect#n1-rect  x=120 y=100 w=160 h=60 fill=#4a90d9',
  '    └── text#n1-label  (140,135) "开始"',
];
const DIRTY_BOX_TREE = [
  'svg (800x600) *',
  '└── g#n1 (box) *',
  '    ├── rect#n1-rect  x=120 y=100 w=160 h=60 fill=#4a90d9 *',
  '    └── text#n1-label  (140,135) "开始" *',
];
const MOVED_BOX_TREE = [
  'svg (800x600) *',
  '└── g#n1 (box) *',
  '    ├── rect#n1-rect  x=120 y=110 w=160 h=60 fill=#4a90d9 *',
  '    └── text#n1-label  (140,145) "开始" *',
];
const MOVED_UNDONE_TREE = [
  'svg (800x600)',
  '└── g#n1 (box)',
  '    ├── rect#n1-rect  x=120 y=100 w=160 h=60 fill=#4a90d9',
  '    └── text#n1-label  (140,135) "开始"',
];

function cli(args: readonly string[], input: string, cwd: string) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, input, encoding: 'utf8' });
}

function embedded(plugins: readonly PluginModule[]) {
  return plugins.map((plugin) => ({ module: plugin, manifest: plugin.manifest }));
}

function treeBlocks(stdout: string): readonly (readonly string[])[] {
  const blocks: string[][] = [];
  for (const line of stdout.split('\n')) {
    if (/^svg \(\d+x\d+\)/.test(line)) {
      blocks.push([line]);
      continue;
    }
    const current = blocks.at(-1);
    if (current && /^\s*[│├└]/.test(line)) current.push(line);
  }
  return blocks;
}

function appWith(files: FakeFileStore) {
  return createApplication({
    files,
    embeddedPlugins: embedded([statsPlugin, dirPlugin, boxPlugin, treeModifiedPlugin]),
  });
}

test('dirty stars follow create, save, move, undo/redo and a second undo to the save point', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-tree-cli-'));
  try {
    const input = [
      'init 800 600',
      'tree',
      'create box n1 120 100 160 60 "开始"',
      'tree',
      'save clean.svg',
      'tree',
      'move n1 0 10',
      'tree',
      'undo',
      'tree',
      'redo',
      'tree',
      'set n1 fill #f5a623',
      'tree',
      'undo',
      'tree',
      'undo',
      'tree',
      '',
    ].join('\n');
    const result = cli(['--config', config], input, work);
    assert.equal(result.status, 0, result.stderr);
    const blocks = treeBlocks(result.stdout);
    assert.equal(blocks.length, 9);
    assert.deepEqual(blocks[0], ['svg (800x600)']);
    assert.deepEqual(blocks[1], DIRTY_BOX_TREE);
    assert.deepEqual(blocks[2], CLEAN_BOX_TREE);
    assert.deepEqual(blocks[3], MOVED_BOX_TREE);
    assert.deepEqual(blocks[4], MOVED_UNDONE_TREE);
    assert.deepEqual(blocks[5], MOVED_BOX_TREE);
    const filled = blocks[6]!.join('\n');
    assert.ok(filled.includes('fill=#f5a623'), 'set fill stars the changed rect');
    assert.ok(blocks[6]!.every((line) => line.endsWith(' *')));
    const undoneFill = blocks[7]!.join('\n');
    assert.ok(undoneFill.includes('fill=#4a90d9'));
    assert.ok(undoneFill.includes('x=120 y=110'), 'fill undo returns to the moved state');
    assert.ok(blocks[7]!.every((line) => line.endsWith(' *')));
    assert.deepEqual(blocks[8], CLEAN_BOX_TREE);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('A and B are byte-identical with box and modified-star both enabled', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-tree-ab-'));
  try {
    const input = [
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      'tree',
      'save clean.svg',
      'move n1 0 10',
      'set n1 label "处理数据 v2"',
      'tree',
      'undo',
      'tree',
      '',
    ].join('\n');
    const a = cli([], input, work);
    const b = cli(['--config', config], input, work);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(a.stdout, b.stdout, 'A and B must be byte-identical');
    assert.equal(a.stderr, b.stderr);
    const blocks = treeBlocks(a.stdout);
    assert.equal(blocks.length, 3);
    assert.ok(blocks[0]!.every((line) => line.endsWith(' *')));
    assert.ok(blocks[1]!.every((line) => line.endsWith(' *')));
    assert.deepEqual(blocks[2], MOVED_BOX_TREE);
    assert.ok(a.stdout.includes('box#n1 moved by (0,10)'));
    assert.ok(a.stdout.includes('box#n1 label updated: "处理数据 v2"'));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('disabling the decorator returns the tree to the unstarred bytes', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-tree-off-'));
  const configDirectory = resolve('artifacts/plugin-tree-tests');
  try {
    await mkdir(configDirectory, { recursive: true });
    const disabledConfig = join(configDirectory, 'disabled.json');
    await writeFile(
      disabledConfig,
      `${JSON.stringify({
        plugins: [
          { module: '@svgframe/command-stats' },
          { module: '@svgframe/command-dir' },
          { module: '@svgframe/shape-box' },
          { module: '@svgframe/tree-modified', enabled: false },
        ],
      })}\n`,
    );
    const input = [
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      'tree',
      'move n1 0 10',
      'tree',
      '',
    ].join('\n');
    const result = cli(['--config', disabledConfig], input, work);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes('*'), false, 'no star may appear when disabled');
    const blocks = treeBlocks(result.stdout);
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0], CLEAN_BOX_TREE);
    assert.deepEqual(blocks[1], [
      'svg (800x600)',
      '└── g#n1 (box)',
      '    ├── rect#n1-rect  x=120 y=110 w=160 h=60 fill=#4a90d9',
      '    └── text#n1-label  (140,145) "开始"',
    ]);
    const similar = await createApplication({
      files: new FakeFileStore(),
      configPath: disabledConfig,
    });
    await similar.dispatcher.execute('init 800 600');
    await similar.dispatcher.execute('create box n1 120 100 160 60 "开始"');
    assert.deepEqual(await similar.dispatcher.execute('tree'), CLEAN_BOX_TREE);
  } finally {
    await rm(work, { recursive: true, force: true });
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test('two application instances keep independent dirty state and read resets it', async () => {
  const files = new FakeFileStore();
  files.files.set(
    'clean.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect id="r" x="0" y="0" width="10" height="10"/></svg>',
  );
  const first = await appWith(files);
  const second = await appWith(new FakeFileStore());
  await first.dispatcher.execute('init 800 600');
  await first.dispatcher.execute('create rect r 0 0 10 10');
  assert.deepEqual(await first.dispatcher.execute('tree'), [
    'svg (800x600) *',
    '└── rect#r  x=0 y=0 w=10 h=10 *',
  ]);
  await second.dispatcher.execute('init 800 600');
  assert.deepEqual(await second.dispatcher.execute('tree'), ['svg (800x600)']);
  await first.dispatcher.execute('save dirty.svg');
  assert.deepEqual(await first.dispatcher.execute('tree'), [
    'svg (800x600)',
    '└── rect#r  x=0 y=0 w=10 h=10',
  ]);
  await first.dispatcher.execute('create circle c 1 2 3');
  assert.deepEqual(await second.dispatcher.execute('tree'), ['svg (800x600)']);
  assert.ok((await first.dispatcher.execute('tree')).some((line) => line.endsWith(' *')));
  await first.dispatcher.execute('read clean.svg');
  assert.deepEqual(await first.dispatcher.execute('tree'), [
    'svg (400x300)',
    '└── rect#r  x=0 y=0 w=10 h=10',
  ]);
});

test('an edit that fails keeps the baseline and the tree clean', async () => {
  const application = await appWith(new FakeFileStore());
  await application.dispatcher.execute('init 800 600');
  await application.dispatcher.execute('create rect r 0 0 10 10');
  await application.dispatcher.execute('save saved.svg');
  assert.deepEqual(await application.dispatcher.execute('tree'), [
    'svg (800x600)',
    '└── rect#r  x=0 y=0 w=10 h=10',
  ]);
  assert.deepEqual(await application.dispatcher.execute('set r width -1'), [
    'error: width must be non-negative',
  ]);
  assert.deepEqual(await application.dispatcher.execute('move missing 1 2'), [
    'error: no such shape: missing',
  ]);
  assert.deepEqual(await application.dispatcher.execute('tree'), [
    'svg (800x600)',
    '└── rect#r  x=0 y=0 w=10 h=10',
  ]);
});

test('the box label comes before the modified star with exactly one space between suffixes', async () => {
  const application = await appWith(new FakeFileStore());
  await application.dispatcher.execute('init 800 600');
  await application.dispatcher.execute('create box n1 120 100 160 60 "开始"');
  const lines = await application.dispatcher.execute('tree');
  assert.equal(lines[1], '└── g#n1 (box) *');
  assert.equal(lines[1]!.includes('(box)  *'), false);
  assert.equal(lines[1]!.includes('* (box)'), false);
  assert.ok(lines.every((line) => !line.endsWith('  ')));
});
