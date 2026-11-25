import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateAction,
  FakeEditorSession,
  FakeShapeCreationService,
  QueryContext,
} from '@svgframe/core';
import { StatsCommand } from '../index.js';
import { FakeLeafShape } from './FakeLeafShape.js';
import type { ReadonlyDocument, ReadonlyShape } from '@svgframe/core';

function snapshot(document: ReadonlyDocument): string {
  const rows: string[] = [];
  const visit = (shape: ReadonlyShape, depth: number): void => {
    const attributes = Object.entries(shape.attributes())
      .map(([name, value]) => `${name}=${value}`)
      .join(',');
    rows.push(`${'  '.repeat(depth)}${shape.tag}#${shape.id}[${shape.kind}] ${attributes}`);
    shape.children().forEach((child) => visit(child, depth + 1));
  };
  document.root.children().forEach((child) => visit(child, 0));
  rows.push(`canvas ${document.width}x${document.height}`);
  return rows.join('\n');
}

function sessionWithRect(): FakeEditorSession {
  const shapes = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
  });
  const session = new FakeEditorSession();
  session.init(400, 300);
  session.edit(new CreateAction(shapes, 'rect', 'r1', []));
  return session;
}

async function run(command: StatsCommand, document: ReadonlyDocument): Promise<readonly string[]> {
  const preparation = command.prepare([]);
  assert.equal(preparation.effect, 'query');
  if (preparation.effect !== 'query') throw new Error('stats must be a query');
  assert.equal(preparation.requiresDocument, true);
  const output = await preparation.operation.execute(new QueryContext(document));
  return typeof output === 'string' ? [output] : output;
}

test('stats is a document query with no arguments and an exact usage error', () => {
  const command = new StatsCommand();
  assert.equal(command.name, 'stats');
  assert.equal(command.usage, 'stats');
  const preparation = command.prepare([]);
  assert.equal(preparation.requiresDocument, true);
  assert.equal(preparation.effect, 'query');
  assert.throws(() => command.prepare(['extra']), /usage: stats/);
  assert.throws(() => command.prepare(['a', 'b']), /usage: stats/);
});

test('stats reports the document line and does not mutate document, history or barrier', async () => {
  const session = sessionWithRect();
  const before = snapshot(session.document());
  const invocations = [...session.invocations];
  assert.deepEqual(await run(new StatsCommand(), session.document()), [
    'rect: 1  (total 1, containers 0)',
  ]);
  assert.equal(snapshot(session.document()), before);
  assert.deepEqual(session.invocations, invocations, 'a query does not call the session');
  assert.equal(session.undo(), 'undone: rect#r1 created', 'no hidden history entry');
  assert.equal(session.redo(), 'redone: rect#r1 created');
});

test('stats keeps the I/O barrier of an untouched document', async () => {
  const session = new FakeEditorSession();
  session.init(400, 300);
  assert.deepEqual(await run(new StatsCommand(), session.document()), ['(total 0, containers 0)']);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.throws(() => session.redo(), /undo not allowed after io command/);
});

test('stats before initialization reports the standard no-document error', () => {
  assert.throws(
    () => new QueryContext(null).document(),
    /no document\. use 'init' or 'read' first/,
  );
});
