import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeEditorSession, FakeShapeCreationService } from '../index.js';
import { DemoBoxProvider } from './support/DemoBoxProvider.js';
import { DemoCreateAction } from './support/DemoCreateAction.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

const shapes = (): FakeShapeCreationService => {
  const service = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  service.register('demo-box', (request) => new DemoBoxProvider().create(request, service));
  return service;
};

test('document() fails before init/read and hasDocument reports the state', () => {
  const session = new FakeEditorSession();
  assert.equal(session.hasDocument(), false);
  assert.throws(() => session.document(), /no document\. use 'init' or 'read' first/);
  session.init();
  assert.equal(session.hasDocument(), true);
  assert.equal(session.document().width, 800);
});

test('init and I/O steps set the Phase 1 undo barrier', async () => {
  const session = new FakeEditorSession();
  session.init(400, 300);
  assert.equal(session.document().width, 400);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  session.edit(new DemoCreateAction(shapes(), 'box1'));
  assert.equal(session.document().all().length, 3);
  await session.save('a.svg');
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});

test('edit/undo/redo replace the document and clear the redo branch', () => {
  const session = new FakeEditorSession();
  session.init();
  session.edit(new DemoCreateAction(shapes(), 'a'));
  session.edit(new DemoCreateAction(shapes(), 'b'));
  assert.equal(session.undo(), 'undone: g#b created');
  assert.deepEqual(
    session
      .document()
      .all()
      .map((shape) => shape.id),
    ['a', 'a-rect', 'a-label'],
  );
  session.edit(new DemoCreateAction(shapes(), 'c'));
  assert.throws(() => session.redo(), /nothing to redo/);
  assert.deepEqual(
    session
      .document()
      .all()
      .map((shape) => shape.id),
    ['a', 'a-rect', 'a-label', 'c', 'c-rect', 'c-label'],
  );
});

test('save remembers the first successful path and init resets it', async () => {
  const session = new FakeEditorSession();
  session.init();
  await assert.rejects(session.save(), /no file path\. use save <file\.svg>/);
  assert.equal(await session.save('x.svg'), 'saved to x.svg (0 elements)');
  assert.equal(await session.save(), 'saved to x.svg (0 elements)');
  assert.deepEqual(session.invocations, ['init 800 600', 'save x.svg', 'save x.svg']);
  session.init();
  await assert.rejects(session.save(), /no file path/);
});

test('read replaces the document and returns warnings plus a summary', async () => {
  const session = new FakeEditorSession();
  session.readWarnings.push('warning: assigned id rect1 to unnamed <rect>');
  const output = await session.read('drawing.svg');
  assert.deepEqual(output, [
    'warning: assigned id rect1 to unnamed <rect>',
    'read drawing.svg (0 elements)',
  ]);
  assert.equal(session.document().all().length, 0);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});

test('canvas queries without size and resizes with both arguments', () => {
  const session = new FakeEditorSession();
  session.init();
  assert.equal(session.canvas(), 'canvas 800x600');
  assert.equal(session.canvas(400, 300), 'canvas 400x300');
  assert.equal(session.document().width, 400);
  assert.equal(session.document().height, 300);
  assert.throws(() => session.canvas(100), /canvas requires both width and height/);
});

test('a failing edit leaves document and history unchanged', () => {
  const session = new FakeEditorSession();
  session.init();
  session.edit(new DemoCreateAction(shapes(), 'a'));
  assert.throws(() => session.edit(new DemoCreateAction(shapes(), 'a')), /id already exists: a/);
  assert.equal(session.document().all().length, 3);
  assert.equal(session.undo(), 'undone: g#a created');
  assert.equal(session.document().all().length, 0);
});
