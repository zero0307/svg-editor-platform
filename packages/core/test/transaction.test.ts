import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttributeEditingService,
  AttributeEditAction,
  AttributeHandlerRegistry,
} from '../index.js';
import type { AttributeHandler } from '../index.js';
import { createDemoDocument, createDemoShapes, createTestSession } from './support/TestSession.js';
import { CountingAction } from './support/CountingAction.js';
import { DemoBoxShape } from './support/DemoBoxShape.js';
import { DemoCreateAction } from './support/DemoCreateAction.js';
import { DemoAttributeHandler } from './support/DemoAttributeHandler.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';
import { MultiPartAttributeHandler } from './support/MultiPartAttributeHandler.js';

const setup = async () => {
  const { session, files } = createTestSession({ documentFactory: () => createDemoDocument() });
  files.files.set('doc.svg', 'source');
  await session.read('doc.svg');
  return { session, files };
};

test('an edit runs on a detached clone and commits one undo unit', () => {
  const { session } = createTestSession();
  session.init();
  const shapes = createDemoShapes();
  const message = session.edit(new DemoCreateAction(shapes, 'box1'));
  assert.equal(message, 'g#box1 created');
  assert.equal(session.document().require('box1').kind, 'demo-box');
  assert.equal(session.document().all().length, 3);
  assert.equal(session.undo(), 'undone: g#box1 created');
  assert.equal(session.document().all().length, 0);
  assert.equal(session.redo(), 'redone: g#box1 created');
  assert.equal(session.document().all().length, 3);
});

test('undo and redo swap validated snapshots without re-running the action', async () => {
  const { session } = await setup();
  const action = new CountingAction();
  session.edit(action);
  assert.equal(action.calls, 1);
  session.undo();
  assert.equal(action.calls, 1);
  session.redo();
  assert.equal(action.calls, 1);
});

test('a multi-part handler produces exactly one undo unit and is not re-run', async () => {
  const { session } = await setup();
  const handler = new MultiPartAttributeHandler();
  const handlers = new AttributeHandlerRegistry();
  handlers.register(handler);
  const service = new AttributeEditingService(handlers);
  const action = new AttributeEditAction(service, {
    targetId: 'box1',
    attribute: 'label',
    value: 'hello',
  });
  assert.equal(session.edit(action), 'label=hello');
  assert.equal(session.document().require('box1-rect').attributes().fill, 'painted');
  assert.equal(session.document().require('box1-label').attributes().fill, 'labelled');
  assert.equal(handler.calls, 1);
  assert.equal(session.undo(), 'undone: label=hello');
  assert.equal(session.document().require('box1-rect').attributes().fill, undefined);
  assert.equal(session.document().require('box1-label').attributes().fill, undefined);
  session.redo();
  assert.equal(handler.calls, 1);
});

test('edits keep the plugin runtime type and never share mutable children', async () => {
  const { session } = await setup();
  const before = session.document();
  const beforeRect = before.require('box1-rect');
  const action = new CountingAction((candidate) => {
    candidate.require('box1-rect').setAttribute('fill', 'changed');
  });
  session.edit(action);
  const after = session.document();
  assert.ok(after.require('box1') instanceof DemoBoxShape);
  assert.notEqual(after.require('box1-rect'), beforeRect);
  assert.equal(beforeRect.attributes().fill, undefined);
  assert.equal(after.require('box1-rect').attributes().fill, 'changed');
  session.undo();
  assert.ok(session.document().require('box1') instanceof DemoBoxShape);
  assert.equal(session.document().require('box1-rect').attributes().fill, undefined);
});

test('a partial modification followed by an error keeps every state and the redo branch', async () => {
  const { session, files } = await setup();
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  session.edit(new CountingAction());
  const failing = new CountingAction(
    (candidate) => candidate.require('leaf').setAttribute('fill', 'mutated'),
    'partial failure',
  );
  assert.throws(() => session.edit(failing), /partial failure/);
  assert.equal(session.document().require('leaf').attributes().fill, undefined);
  assert.deepEqual(events, ['editCommitted']);

  session.edit(new CountingAction());
  session.undo();
  assert.throws(() => session.edit(failing), /partial failure/);
  assert.equal(session.redo(), 'redone: counted edit');
  assert.equal(session.document().require('leaf').attributes().fill, undefined);

  files.failWrite = 'cannot write file: doc.svg';
  await assert.rejects(session.save(), /cannot write file: doc\.svg/);
  assert.equal(session.undo(), 'undone: counted edit');
});

test('an invariant failure discards the candidate and publishes no event', async () => {
  const { session } = await setup();
  session.edit(new CountingAction());
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  const failing = new CountingAction((candidate) => {
    const leaf = candidate.require('leaf') as FakeLeafShape;
    leaf.violation = 'broken invariant';
  });
  assert.throws(() => session.edit(failing), /broken invariant/);
  assert.equal(session.document().require('leaf').id, 'leaf');
  assert.deepEqual(events, []);
  assert.equal(session.undo(), 'undone: counted edit');
});

test('an attribute conflict keeps the document and an existing redo branch', async () => {
  const { session } = await setup();
  session.edit(new CountingAction());
  session.undo();
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new DemoAttributeHandler());
  const other: AttributeHandler = {
    name: 'other-attributes',
    handles: (shape, attribute) => shape.kind === 'demo-box' && attribute === 'fill',
    apply: () => ({}),
  };
  handlers.register(other);
  const action = new AttributeEditAction(new AttributeEditingService(handlers), {
    targetId: 'box1',
    attribute: 'fill',
    value: 'red',
  });
  assert.throws(
    () => session.edit(action),
    /ambiguous attribute handlers for box1\.fill: demo-attributes, other-attributes/,
  );
  assert.equal(session.document().require('box1-rect').attributes().fill, undefined);
  assert.equal(session.redo(), 'redone: counted edit');
});

test('read-only queries do not clear history or unblock the barrier', async () => {
  const { session } = await setup();
  session.edit(new CountingAction());
  session.undo();
  session.document();
  session.hasDocument();
  session.canvas();
  assert.equal(session.redo(), 'redone: counted edit');

  await session.save('doc.svg');
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  session.document();
  session.canvas();
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});
