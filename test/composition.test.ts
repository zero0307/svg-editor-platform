import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CommandRegistry, FakeEditorSession, FakeFileStore } from '@svgframe/core';
import { CommandDispatcher, createApplication } from '@svgframe/cli';
import type { Command, CommandPreparation } from '@svgframe/core';

const entry = resolve('apps/cli/dist/main.js');
const config = resolve('plugins.config.json');

test('composition roots A and B produce byte-identical output without plugins', async () => {
  const work = await mkdtemp(join(tmpdir(), 'svg-cli-ab-'));
  try {
    const session = 'init 400 300\ncreate rect r 1 2 3 4 red\ntree\nunknown\nshow r\n';
    const a = spawnSync(process.execPath, [entry], { cwd: work, input: session, encoding: 'utf8' });
    const b = spawnSync(process.execPath, [entry, '--config', config], {
      cwd: work,
      input: session,
      encoding: 'utf8',
    });
    assert.equal(a.status, 1);
    assert.equal(b.status, 1);
    assert.equal(a.stdout, b.stdout);
    assert.equal(a.stderr, b.stderr);
    assert.match(a.stdout, /rect#r  x=1 y=2 w=3 h=4 fill=red/);
    assert.match(a.stdout, /error: unknown command: unknown/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('the built-in capability set is installed through the plugin installer', async () => {
  const application = await createApplication({ files: new FakeFileStore() });
  assert.equal(application.results[0]?.ok, true);
  assert.equal(application.commands.names().length, 19);
  assert.equal(application.session.hasDocument(), false);
  const canvas = application.commands.require('canvas');
  assert.equal(canvas.prepare([]).effect, 'query');
  const resize = canvas.prepare(['400', '300']);
  assert.equal(resize.effect, 'document');
  assert.equal(resize.requiresDocument, true);
});

test('requiresDocument:false commands run without a document while others fail', async () => {
  const registry = new CommandRegistry();
  const queryOnly: Command = {
    name: 'status',
    usage: 'status',
    prepare: (): CommandPreparation => ({
      requiresDocument: false,
      effect: 'query',
      operation: { execute: () => 'ready' },
    }),
  };
  const needsDocument: Command = {
    name: 'peek',
    usage: 'peek',
    prepare: (): CommandPreparation => ({
      requiresDocument: true,
      effect: 'query',
      operation: { execute: () => 'peeked' },
    }),
  };
  registry.register(queryOnly);
  registry.register(needsDocument);
  const session = new FakeEditorSession();
  const dispatcher = new CommandDispatcher(registry, session);
  assert.deepEqual(await dispatcher.execute('status'), ['ready']);
  assert.equal(session.hasDocument(), false);
  assert.deepEqual(await dispatcher.execute('peek'), [
    "error: no document. use 'init' or 'read' first",
  ]);
});
