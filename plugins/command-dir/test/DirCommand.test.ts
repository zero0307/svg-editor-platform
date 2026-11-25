import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateAction,
  FakeDirectoryReader,
  FakeEditorSession,
  FakeShapeCreationService,
  QueryContext,
} from '@svgframe/core';
import { DirCommand } from '../index.js';
import { FakeRectShape } from './FakeRectShape.js';
import type { ReadonlyDocument } from '@svgframe/core';

const entries = [
  { name: 'docs', kind: 'directory' as const },
  { name: 'demo.svg', kind: 'file' as const },
];

function snapshot(document: ReadonlyDocument): string {
  const rows: string[] = [];
  const visit = (shape: ReadonlyDocument['root'], depth: number): void => {
    rows.push(`${'  '.repeat(depth)}${shape.tag}#${shape.id}[${shape.kind}]`);
    shape.children().forEach((child) => visit(child, depth + 1));
  };
  document.root.children().forEach((child) => visit(child, 0));
  rows.push(`canvas ${document.width}x${document.height}`);
  return rows.join('\n');
}

function sessionWithCircle(): FakeEditorSession {
  const shapes = new FakeShapeCreationService({
    circle: (request) => new FakeRectShape(request.id, 'circle'),
  });
  const session = new FakeEditorSession();
  session.init(400, 300);
  session.edit(new CreateAction(shapes, 'circle', 'c', []));
  return session;
}

async function run(command: DirCommand, context: QueryContext): Promise<readonly string[]> {
  const preparation = command.prepare([]);
  assert.equal(preparation.effect, 'query');
  if (preparation.effect !== 'query') throw new Error('dir must be a query');
  assert.equal(preparation.requiresDocument, false);
  const output = await preparation.operation.execute(context);
  return typeof output === 'string' ? [output] : output;
}

test('dir is a document-free query with no arguments and an exact usage error', () => {
  const command = new DirCommand();
  assert.equal(command.name, 'dir');
  assert.equal(command.usage, 'dir');
  const preparation = command.prepare([]);
  assert.equal(preparation.requiresDocument, false);
  assert.equal(preparation.effect, 'query');
  assert.throws(() => command.prepare(['extra']), /usage: dir/);
  assert.throws(() => command.prepare(['a', 'b']), /usage: dir/);
});

test('dir works before initialization and only reads through the directory port', async () => {
  const reader = new FakeDirectoryReader('/work', { '/work': entries });
  assert.deepEqual(await run(new DirCommand(), new QueryContext(null, reader)), [
    '[DIR]  docs',
    '[FILE]  demo.svg',
  ]);
});

test('dir reports the documented wording when the directory port is missing', async () => {
  await assert.rejects(
    run(new DirCommand(), new QueryContext(null)),
    /directory access is not available/,
  );
});

test('dir keeps document, history, barrier and an existing redo branch untouched', async () => {
  const reader = new FakeDirectoryReader('/work', { '/work': entries });
  const session = sessionWithCircle();
  session.undo();
  const before = snapshot(session.document());
  const invocations = [...session.invocations];
  assert.deepEqual(await run(new DirCommand(), new QueryContext(session.document(), reader)), [
    '[DIR]  docs',
    '[FILE]  demo.svg',
  ]);
  assert.equal(snapshot(session.document()), before);
  assert.deepEqual(session.invocations, invocations, 'a query does not call the session');
  assert.equal(session.redo(), 'redone: circle#c created', 'redo branch survives dir');
  assert.equal(session.undo(), 'undone: circle#c created');
});

test('dir does not clear the I/O barrier of a freshly initialized document', async () => {
  const reader = new FakeDirectoryReader('/work', { '/work': entries });
  const session = new FakeEditorSession();
  session.init(400, 300);
  assert.deepEqual(await run(new DirCommand(), new QueryContext(session.document(), reader)), [
    '[DIR]  docs',
    '[FILE]  demo.svg',
  ]);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.throws(() => session.redo(), /undo not allowed after io command/);
});

test('a read failure leaves document and history untouched and keeps the redo branch usable', async () => {
  const reader = new FakeDirectoryReader('/work');
  const session = sessionWithCircle();
  session.undo();
  const before = snapshot(session.document());
  await assert.rejects(
    run(new DirCommand(), new QueryContext(session.document(), reader)),
    /cannot read directory: \/work/,
  );
  assert.equal(snapshot(session.document()), before);
  assert.equal(session.redo(), 'redone: circle#c created');
});
