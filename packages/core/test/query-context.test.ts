import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDirectoryReader, QueryContext, SvgDocument } from '../index.js';

test('query context exposes the injected directory port without a session', () => {
  const directories = new FakeDirectoryReader('/work', {
    '/work': [
      { name: 'alpha.txt', kind: 'file' },
      { name: 'docs', kind: 'directory' },
    ],
  });
  const context = new QueryContext(new SvgDocument(), directories);
  assert.equal(context.hasDocument, true);
  assert.equal(context.document().width, 800);
  assert.equal(context.directories().cwd(), '/work');
  assert.equal((context as unknown as { session?: unknown }).session, undefined);
});

test('a query context without the port reports the documented error', () => {
  const context = new QueryContext(null);
  assert.equal(context.hasDocument, false);
  assert.throws(() => context.document(), /no document\. use 'init' or 'read' first/);
  assert.throws(() => context.directories(), /directory access is not available/);
});
