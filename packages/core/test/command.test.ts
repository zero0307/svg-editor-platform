import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandRegistry, FakeEditorSession, FakeShapeCreationService } from '../index.js';
import { DemoCanvasCommand } from './support/DemoCanvasCommand.js';
import { DemoCreateCommand } from './support/DemoCreateCommand.js';
import { DemoBoxProvider } from './support/DemoBoxProvider.js';
import { DemoQueryCommand } from './support/DemoQueryCommand.js';
import { DemoUndoCommand } from './support/DemoUndoCommand.js';
import { SampleCommandDispatcher } from './support/SampleCommandDispatcher.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

const setup = () => {
  const shapes = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  shapes.register('demo-box', (request) => new DemoBoxProvider().create(request, shapes));
  const session = new FakeEditorSession();
  const commands = new CommandRegistry();
  commands.register(new DemoCreateCommand(shapes));
  commands.register(new DemoCanvasCommand());
  commands.register(new DemoQueryCommand('demo-stats'));
  commands.register(new DemoUndoCommand());
  return { shapes, session, commands, dispatcher: new SampleCommandDispatcher(commands, session) };
};

test('preparation declares prerequisites and effects instead of names', () => {
  const edit = new DemoCreateCommand(setup().shapes).prepare(['box1']);
  assert.equal(edit.effect, 'edit');
  assert.equal(edit.requiresDocument, true);
  if (edit.effect !== 'edit') throw new Error('expected edit preparation');
  assert.equal(edit.action.constructor.name, 'DemoCreateAction');

  const query = new DemoCanvasCommand().prepare([]);
  assert.equal(query.effect, 'query');
  assert.equal(query.requiresDocument, true);
  if (query.effect !== 'query') throw new Error('expected query preparation');
  assert.equal(typeof query.operation.execute, 'function');

  const resize = new DemoCanvasCommand().prepare(['400', '300']);
  assert.equal(resize.effect, 'document');
  assert.equal(resize.requiresDocument, true);
});

test('prerequisites come from metadata, never from a command name', async () => {
  const session = new FakeEditorSession();
  const commands = new CommandRegistry();
  commands.register(new DemoQueryCommand('read', true));
  const dispatcher = new SampleCommandDispatcher(commands, session);
  await assert.rejects(dispatcher.execute('read'), /no document\. use 'init' or 'read' first/);
  assert.equal(session.hasDocument(), false);
});

test('a command that needs no document runs without one', async () => {
  const session = new FakeEditorSession();
  const commands = new CommandRegistry();
  commands.register(new DemoQueryCommand('dir', false));
  const dispatcher = new SampleCommandDispatcher(commands, session);
  assert.equal(await dispatcher.execute('dir'), 'no document');
  assert.equal(session.hasDocument(), false);
});

test('unknown commands fail with the Phase 1 wording', async () => {
  const { dispatcher } = setup();
  await assert.rejects(dispatcher.execute('nope'), /unknown command: nope/);
});

test('each command owns its parameter rules', async () => {
  const { dispatcher } = setup();
  await assert.rejects(dispatcher.execute('demo-create'), /usage: demo-create <id>/);
  await assert.rejects(dispatcher.execute('demo-canvas', ['400']), /usage: demo-canvas \[w h\]/);
});

test('a query does not clear history or set the I/O barrier', async () => {
  const { dispatcher, session } = setup();
  session.init();
  assert.equal(await dispatcher.execute('demo-create', ['box1']), 'g#box1 created');
  assert.equal(await dispatcher.execute('demo-canvas'), 'canvas 800x600');
  assert.equal(session.document().width, 800);
  assert.equal(session.undo(), 'undone: g#box1 created');
  assert.equal(session.document().all().length, 0);
});

test('canvas size arguments are a document effect that sets the barrier', async () => {
  const { dispatcher, session } = setup();
  session.init();
  await dispatcher.execute('demo-create', ['box1']);
  assert.equal(await dispatcher.execute('demo-canvas', ['400', '300']), 'canvas 400x300');
  assert.equal(session.document().width, 400);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});

test('a failing edit leaves document, history and redo untouched', async () => {
  const { dispatcher, session } = setup();
  session.init();
  await dispatcher.execute('demo-create', ['box1']);
  assert.equal(session.document().all().length, 3);
  await assert.rejects(dispatcher.execute('demo-create', ['box1']), /id already exists: box1/);
  assert.equal(session.document().all().length, 3);
  assert.equal(session.document().require('box1').kind, 'demo-box');
  assert.equal(session.undo(), 'undone: g#box1 created');
  assert.equal(session.document().all().length, 0);
});

test('history commands are routed through the history effect', async () => {
  const { dispatcher, session } = setup();
  session.init();
  await dispatcher.execute('demo-create', ['box1']);
  assert.equal(await dispatcher.execute('demo-undo'), 'undone: g#box1 created');
  assert.equal(session.document().all().length, 0);
  assert.equal(session.redo(), 'redone: g#box1 created');
  assert.equal(session.document().all().length, 3);
});

test('edit and history commands require an existing document', async () => {
  const { dispatcher } = setup();
  await assert.rejects(dispatcher.execute('demo-create', ['box1']), /no document/);
  await assert.rejects(dispatcher.execute('demo-undo'), /no document/);
});
