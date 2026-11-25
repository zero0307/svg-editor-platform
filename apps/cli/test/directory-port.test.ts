import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommandRegistry,
  FakeDirectoryReader,
  FakeEditorSession,
  QueryContext,
} from '@svgframe/core';
import type { Command, CommandPreparation } from '@svgframe/core';
import { CommandDispatcher } from '../src/CommandDispatcher.js';

const directoryCommand = (): Command => ({
  name: 'read',
  usage: 'read',
  prepare: (): CommandPreparation => ({
    requiresDocument: false,
    effect: 'query',
    operation: {
      execute: async (context) => {
        const reader = context.directories();
        const entries = await reader.list(reader.cwd());
        return entries.map((entry) => `${entry.kind} ${entry.name}`);
      },
    },
  }),
});

const requiringCommand = (): Command => ({
  name: 'help',
  usage: 'help',
  prepare: (): CommandPreparation => ({
    requiresDocument: true,
    effect: 'query',
    operation: { execute: () => 'should not run' },
  }),
});

test('a requiresDocument:false query reads directories without a document', async () => {
  const directoryReader = new FakeDirectoryReader('/work', {
    '/work': [
      { name: 'alpha.txt', kind: 'file' },
      { name: 'docs', kind: 'directory' },
    ],
  });
  const registry = new CommandRegistry();
  registry.register(directoryCommand());
  registry.register(requiringCommand());
  const session = new FakeEditorSession();
  const dispatcher = new CommandDispatcher(registry, session, directoryReader);

  assert.deepEqual(await dispatcher.execute('read'), ['file alpha.txt', 'directory docs']);
  assert.equal(session.hasDocument(), false);
  assert.deepEqual(await dispatcher.execute('help'), [
    "error: no document. use 'init' or 'read' first",
  ]);

  session.init(400, 300);
  const width = session.document().width;
  assert.deepEqual(await dispatcher.execute('read'), ['file alpha.txt', 'directory docs']);
  assert.equal(session.document().width, width);
  assert.equal(session.document().all().length, 0);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});

test('the missing directory port keeps the documented error wording', () => {
  const context = new QueryContext(null);
  assert.throws(() => context.directories(), /directory access is not available/);
});
