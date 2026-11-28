import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError, SvgDocument } from '../index.js';
import type { EditorEvent } from '../index.js';
import { createDemoDocument, createTestSession } from './support/TestSession.js';
import { CountingAction } from './support/CountingAction.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

const duplicateIdDocument = (): SvgDocument => {
  const document = new SvgDocument();
  const shape = new FakeLeafShape('dup');
  document.add(shape);
  document.root.insert(new FakeLeafShape('dup'));
  return document;
};

test('document and hasDocument expose the initialized state', () => {
  const { session } = createTestSession();
  assert.equal(session.hasDocument(), false);
  assert.throws(() => session.document(), /no document\. use 'init' or 'read' first/);
  session.init();
  assert.equal(session.hasDocument(), true);
  assert.equal(session.document().width, 800);
});

test('init creates a fresh canvas, resets the path and sets the barrier', async () => {
  const { session } = createTestSession();
  const events: EditorEvent[] = [];
  session.events.subscribe((event) => events.push(event));
  session.init(400, 300);
  assert.equal(session.document().width, 400);
  assert.equal(session.document().height, 300);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.equal(events[0]?.type, 'documentInitialized');
  assert.throws(() => session.init(0, 300), /width must be positive/);
  assert.equal(session.document().width, 400);
  const { session: second, files } = createTestSession();
  second.init();
  await second.save('first.svg');
  assert.equal(files.files.has('first.svg'), true);
  second.init();
  await assert.rejects(second.save(), /no file path/);
});

test('read decodes, validates, remembers the path and sets the barrier', async () => {
  const { session, files } = createTestSession({
    documentFactory: () => createDemoDocument(),
    warnings: ['warning: assigned id rect1 to unnamed <rect>'],
  });
  files.files.set('drawing.svg', '<svg/>');
  const events: EditorEvent[] = [];
  session.events.subscribe((event) => events.push(event));
  const output = await session.read('drawing.svg');
  assert.deepEqual(output, [
    'warning: assigned id rect1 to unnamed <rect>',
    'read drawing.svg (4 elements)',
  ]);
  assert.equal(session.document().require('box1').kind, 'demo-box');
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  const event = events[0]!;
  assert.equal(event.type, 'documentRead');
  if (event.type !== 'documentRead') throw new Error('expected documentRead');
  assert.equal(event.path, 'drawing.svg');
  assert.deepEqual(event.warnings, ['warning: assigned id rect1 to unnamed <rect>']);
});

test('read failures keep document, path, barrier, history and events unchanged', async () => {
  const { session, files } = createTestSession({ documentFactory: () => createDemoDocument() });
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  session.init();
  const edit = new CountingAction();
  session.edit(edit);
  assert.equal(session.document().all().length, 0);

  files.failRead = 'cannot read file: missing.svg';
  await assert.rejects(session.read('missing.svg'), /cannot read file: missing\.svg/);
  files.failRead = undefined;
  files.files.set('broken.svg', 'source');
  const broken = createTestSession({ decodeFailure: 'invalid SVG XML' });
  broken.files.files.set('broken.svg', 'source');
  await assert.rejects(broken.session.read('broken.svg'), /invalid SVG XML/);
  assert.equal(broken.session.hasDocument(), false);

  const invalid = createTestSession({ documentFactory: duplicateIdDocument });
  invalid.files.files.set('invalid.svg', 'source');
  await assert.rejects(invalid.session.read('invalid.svg'), /id already exists: dup/);
  assert.equal(invalid.session.hasDocument(), false);

  assert.equal(session.undo(), 'undone: counted edit');
  assert.deepEqual(events, ['documentInitialized', 'editCommitted', 'undoCommitted']);
});

test('save encodes and writes before committing path and barrier', async () => {
  const { session, files } = createTestSession();
  session.init();
  const events: EditorEvent[] = [];
  session.events.subscribe((event) => events.push(event));
  assert.equal(await session.save('a.svg'), 'saved to a.svg (0 elements)');
  assert.equal(files.files.get('a.svg'), 'encoded 800x600 (0 elements)');
  assert.equal(await session.save(), 'saved to a.svg (0 elements)');
  const saved = events.at(-1)!;
  assert.equal(saved.type, 'documentSaved');
  if (saved.type !== 'documentSaved') throw new Error('expected documentSaved');
  assert.equal(saved.path, 'a.svg');
});

test('an explicit save keeps the path established by read', async () => {
  const { session, files } = createTestSession();
  files.files.set('read.svg', 'source');
  await session.read('read.svg');
  await session.save('explicit.svg');
  await session.save();
  assert.equal(files.files.has('explicit.svg'), true);
  assert.equal(files.files.has('read.svg'), true);
});

test('save failures do not set the barrier, clear dirty state or publish events', async () => {
  const { session, files } = createTestSession();
  session.init();
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  session.edit(new CountingAction());
  files.failWrite = 'cannot write file: x.svg';
  await assert.rejects(session.save('x.svg'), /cannot write file: x\.svg/);
  assert.deepEqual(events, ['editCommitted']);
  assert.equal(session.undo(), 'undone: counted edit');

  session.init();
  session.edit(new CountingAction());
  const failingEncode = createTestSession({ encodeFailure: 'cannot encode document' });
  failingEncode.session.init();
  await assert.rejects(failingEncode.session.save('x.svg'), /cannot encode document/);
  assert.equal(failingEncode.files.files.has('x.svg'), false);
});

test('canvas queries keep redo and the barrier; resizing commits a new canvas', () => {
  const { session } = createTestSession();
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  session.init();
  session.edit(new CountingAction());
  session.edit(new CountingAction());
  session.undo();
  assert.equal(session.canvas(), 'canvas 800x600');
  assert.equal(session.redo(), 'redone: counted edit');
  assert.equal(session.canvas(400, 300), 'canvas 400x300');
  assert.equal(session.document().width, 400);
  assert.equal(session.document().height, 300);
  assert.equal(events.at(-1), 'canvasChanged');
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.throws(() => session.canvas(400, 0), /height must be positive/);
  assert.equal(session.document().width, 400);
});

test('a partial canvas size is rejected and leaves state untouched', () => {
  const { session } = createTestSession();
  session.init();
  assert.throws(() => session.canvas(400), /canvas requires both width and height/);
  assert.equal(session.document().width, 800);
});

test('publishes the seven committed event types in order', async () => {
  const { session, files } = createTestSession();
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  session.init();
  session.edit(new CountingAction());
  await session.save('a.svg');
  session.canvas(400, 300);
  files.files.set('b.svg', 'source');
  await session.read('b.svg');
  session.edit(new CountingAction());
  session.undo();
  session.redo();
  assert.deepEqual(events, [
    'documentInitialized',
    'editCommitted',
    'documentSaved',
    'canvasChanged',
    'documentRead',
    'editCommitted',
    'undoCommitted',
    'redoCommitted',
  ]);
});

test('observer failures are isolated and reported after successful steps', () => {
  const failures: string[] = [];
  const { session } = createTestSession({}, (error) => failures.push(String(error)));
  const seen: string[] = [];
  session.events.subscribe(() => {
    throw new DomainError('listener broke');
  });
  session.events.subscribe((event) => seen.push(event.type));
  session.init();
  session.edit(new CountingAction());
  assert.deepEqual(seen, ['documentInitialized', 'editCommitted']);
  assert.equal(failures.length, 2);
  assert.equal(session.document().all().length, 0);
});

test('a failed init publishes no event and keeps the previous document', () => {
  const { session } = createTestSession();
  session.init();
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  assert.throws(() => session.init(-1, 100), /width must be positive/);
  assert.deepEqual(events, []);
  assert.equal(session.document().width, 800);
});
