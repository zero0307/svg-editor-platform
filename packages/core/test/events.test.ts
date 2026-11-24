import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DomainError,
  EditorEventBus,
  FakeEditorSession,
  FakeShapeCreationService,
  FaultyTreeDecorator,
  SvgDocument,
} from '../index.js';
import type { EditorEvent } from '../index.js';
import { DemoBoxProvider } from './support/DemoBoxProvider.js';
import { DemoCreateAction } from './support/DemoCreateAction.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

const initializedEvent = (): EditorEvent => ({
  type: 'documentInitialized',
  document: new SvgDocument(),
});

test('the event bus keeps subscription order and supports unsubscribe', () => {
  const bus = new EditorEventBus();
  const seen: string[] = [];
  const unsubscribeFirst = bus.subscribe((event) => seen.push(`first:${event.type}`));
  bus.subscribe((event) => seen.push(`second:${event.type}`));
  assert.equal(bus.observerCount, 2);
  bus.publish(initializedEvent());
  unsubscribeFirst();
  assert.equal(bus.observerCount, 1);
  bus.publish(initializedEvent());
  assert.deepEqual(seen, [
    'first:documentInitialized',
    'second:documentInitialized',
    'second:documentInitialized',
  ]);
});

test('a failing observer is isolated and reported without blocking others', () => {
  const failures: { error: unknown; type: string }[] = [];
  const bus = new EditorEventBus((error, event) => failures.push({ error, type: event.type }));
  const seen: string[] = [];
  bus.subscribe(() => {
    throw new DomainError('observer broke');
  });
  bus.subscribe((event) => seen.push(event.type));
  assert.doesNotThrow(() => bus.publish(initializedEvent()));
  assert.deepEqual(seen, ['documentInitialized']);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]!.type, 'documentInitialized');
  assert.match(String((failures[0]!.error as Error).message), /observer broke/);
});

test('decorator event observer failures cannot escape the committed event', () => {
  const bus = new EditorEventBus();
  const faulty = new FaultyTreeDecorator('faulty-decorator', 'event');
  bus.subscribe((event) => faulty.onEvent?.(event));
  const seen: string[] = [];
  bus.subscribe((event) => seen.push(event.type));
  assert.doesNotThrow(() =>
    bus.publish({ type: 'editCommitted', document: new SvgDocument(), message: 'done' }),
  );
  assert.deepEqual(seen, ['editCommitted']);
});

test('the fake session publishes exactly the committed events', async () => {
  const session = new FakeEditorSession();
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  session.init();
  const shapes = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  shapes.register('demo-box', (request) => new DemoBoxProvider().create(request, shapes));
  session.edit(new DemoCreateAction(shapes, 'box1'));
  await session.save('a.svg');
  session.canvas(400, 300);
  await session.read('b.svg');
  assert.deepEqual(events, [
    'documentInitialized',
    'editCommitted',
    'documentSaved',
    'canvasChanged',
    'documentRead',
  ]);

  const history = new FakeEditorSession();
  const historyEvents: string[] = [];
  history.events.subscribe((event) => historyEvents.push(event.type));
  history.init();
  history.edit(new DemoCreateAction(shapes, 'box2'));
  history.undo();
  history.redo();
  assert.deepEqual(historyEvents, [
    'documentInitialized',
    'editCommitted',
    'undoCommitted',
    'redoCommitted',
  ]);
});

test('a failed step publishes no event and leaves the document intact', async () => {
  const session = new FakeEditorSession();
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  session.init();
  await assert.rejects(session.save(), /no file path\. use save <file\.svg>/);
  assert.deepEqual(events, ['documentInitialized']);
  assert.equal(session.document().all().length, 0);
});

test('a broken observer cannot break a successful session step', () => {
  const failures: unknown[] = [];
  const session = new FakeEditorSession(undefined, (error) => failures.push(error));
  session.events.subscribe(() => {
    throw new DomainError('listener broke');
  });
  session.init();
  assert.equal(session.hasDocument(), true);
  assert.equal(session.document().width, 800);
  assert.equal(failures.length, 1);
});

test('read events carry the path and warnings', async () => {
  const session = new FakeEditorSession();
  const events: EditorEvent[] = [];
  session.events.subscribe((event) => events.push(event));
  session.readWarnings.push('warning: assigned id rect1 to unnamed <rect>');
  const output = await session.read('drawing.svg');
  assert.deepEqual(output, [
    'warning: assigned id rect1 to unnamed <rect>',
    'read drawing.svg (0 elements)',
  ]);
  const event = events[0]!;
  assert.equal(event.type, 'documentRead');
  if (event.type !== 'documentRead') throw new Error('expected documentRead');
  assert.equal(event.path, 'drawing.svg');
  assert.deepEqual(event.warnings, ['warning: assigned id rect1 to unnamed <rect>']);
});
