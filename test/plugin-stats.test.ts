import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FakeFileStore } from '@svgframe/core';
import { createApplication } from '@svgframe/cli';
import statsPlugin from '@svgframe/command-stats';

const entry = resolve('apps/cli/dist/main.js');
const config = resolve('plugins.config.json');
const statsUsage = 'stats';

function cli(args: readonly string[], input: string, cwd: string) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, input, encoding: 'utf8' });
}

function usageLines(help: readonly string[]): readonly string[] {
  return help.filter((line) => line.trim() === statsUsage);
}

test('composition roots A and B expose the same stats command and byte-identical output', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-stats-ab-'));
  try {
    const session = [
      'init 400 300',
      'create rect r 1 2 3 4 red',
      'create g g1',
      'create circle c 1 2 3 in g1',
      'stats',
      'help',
      '',
    ].join('\n');
    const a = cli([], session, work);
    const b = cli(['--config', config], session, work);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(a.stdout, b.stdout, 'A and B must be byte-identical for the same plugin set');
    assert.equal(a.stderr, b.stderr);
    assert.match(a.stdout, /^rect: 1 {2}circle: 1 {2}\(total 2, containers 1\)$/m);
    assert.equal(usageLines(a.stdout.split('\n')).length, 1, 'help lists stats once');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('a disabled stats entry keeps help quiet and reports unknown command', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-stats-off-'));
  const configDirectory = resolve('artifacts/plugin-stats-tests');
  const disabledConfig = join(configDirectory, 'disabled.json');
  try {
    await mkdir(configDirectory, { recursive: true });
    await writeFile(
      disabledConfig,
      `${JSON.stringify({ plugins: [{ module: '@svgframe/command-stats', enabled: false }] })}\n`,
    );
    const result = cli(['--config', disabledConfig], 'init 400 300\nstats\nhelp\n', work);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^error: unknown command: stats$/m);
    assert.equal(
      usageLines(result.stdout.split('\n')).length,
      0,
      'disabled plugin adds no help line',
    );
    const application = await createApplication({
      files: new FakeFileStore(),
      configPath: disabledConfig,
    });
    assert.equal(application.commands.has('stats'), false);
    assert.deepEqual(await application.dispatcher.execute('stats'), [
      'error: unknown command: stats',
    ]);
  } finally {
    await rm(work, { recursive: true, force: true });
    await rm(configDirectory, { recursive: true, force: true });
  }
});

test('stats requires a document and reports the standard error without one', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-stats-nodoc-'));
  try {
    const result = cli([], 'stats\n', work);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "error: no document. use 'init' or 'read' first\n");
    const application = await createApplication({
      files: new FakeFileStore(),
      embeddedPlugins: [{ module: statsPlugin, manifest: statsPlugin.manifest }],
    });
    assert.deepEqual(await application.dispatcher.execute('stats'), [
      "error: no document. use 'init' or 'read' first",
    ]);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('A and B install the same command registry and report the same stats line', async () => {
  const configDirectory = resolve('artifacts/plugin-stats-tests');
  try {
    await mkdir(configDirectory, { recursive: true });
    const statsOnlyConfig = join(configDirectory, 'stats-only.json');
    await writeFile(
      statsOnlyConfig,
      `${JSON.stringify({ plugins: [{ module: '@svgframe/command-stats' }] })}\n`,
    );
    const a = await createApplication({
      files: new FakeFileStore(),
      embeddedPlugins: [{ module: statsPlugin, manifest: statsPlugin.manifest }],
    });
    const b = await createApplication({
      files: new FakeFileStore(),
      configPath: statsOnlyConfig,
    });
    assert.deepEqual(a.commands.names(), b.commands.names());
    assert.equal(
      a.commands.names().indexOf('stats'),
      19,
      'stats appends after the 19 Phase 1 commands',
    );
    assert.deepEqual(await a.dispatcher.help(), await b.dispatcher.help());
    const run = async (application: typeof a): Promise<readonly string[]> => {
      await application.dispatcher.execute('init 400 300');
      const rejected = await application.dispatcher.execute('create box b 0 0 1 1 "title"');
      await application.dispatcher.execute('create circle c 1 2 3');
      return [...rejected, ...(await application.dispatcher.execute('stats'))];
    };
    const aOutput = await run(a);
    assert.deepEqual(aOutput, await run(b));
    assert.deepEqual(aOutput, [
      'error: unknown shape type: box (is the plugin loaded?)',
      'circle: 1  (total 1, containers 0)',
    ]);
    for (const result of [...a.results, ...b.results]) assert.equal(result.ok, true);
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
});
