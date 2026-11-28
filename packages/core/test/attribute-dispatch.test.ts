import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttributeEditingService,
  AttributeEditAction,
  AttributeHandlerRegistry,
} from '../index.js';
import type { AttributeHandler } from '../index.js';
import { createDemoDocument, createTestSession } from './support/TestSession.js';
import { CountingAction } from './support/CountingAction.js';
import { DemoAttributeHandler } from './support/DemoAttributeHandler.js';
import { PartialFaultyAttributeHandler } from './support/PartialFaultyAttributeHandler.js';

const setup = async () => {
  const { session, files } = createTestSession({ documentFactory: () => createDemoDocument() });
  files.files.set('doc.svg', 'source');
  await session.read('doc.svg');
  return { session, files };
};

const editAttribute = (
  handlers: AttributeHandlerRegistry,
  targetId: string,
  attribute: string,
  value: string,
) => new AttributeEditAction(new AttributeEditingService(handlers), { targetId, attribute, value });

test('no matching handler falls back to the default attribute rules', async () => {
  const { session } = await setup();
  const handlers = new AttributeHandlerRegistry();
  const message = session.edit(editAttribute(handlers, 'leaf', 'fill', 'red'));
  assert.equal(message, 'rect#leaf updated: fill="red"');
  assert.equal(session.document().require('leaf').attributes().fill, 'red');
  assert.equal(session.undo(), 'undone: rect#leaf updated: fill="red"');
  assert.equal(session.document().require('leaf').attributes().fill, undefined);
});

test('unknown default attributes fail with the Phase 1 wording and no change', async () => {
  const { session } = await setup();
  const handlers = new AttributeHandlerRegistry();
  assert.throws(
    () => session.edit(editAttribute(handlers, 'leaf', 'label', 'x')),
    /unknown attribute: label/,
  );
  assert.equal(session.document().require('leaf').attributes().label, undefined);
  assert.equal(session.hasDocument(), true);
});

test('a matched handler owns the feedback and modifies the candidate only', async () => {
  const { session } = await setup();
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new DemoAttributeHandler());
  const message = session.edit(editAttribute(handlers, 'box1', 'fill', 'green'));
  assert.equal(message, 'fill=green');
  assert.equal(session.document().require('box1-rect').attributes().fill, 'green');
  session.undo();
  assert.equal(session.document().require('box1-rect').attributes().fill, undefined);
});

test('a partial handler failure is propagated without default fallback', async () => {
  const { session } = await setup();
  session.edit(new CountingAction());
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new PartialFaultyAttributeHandler());
  assert.throws(
    () => session.edit(editAttribute(handlers, 'box1', 'fill', 'red')),
    /handler failed after partial modification/,
  );
  assert.equal(session.document().require('box1-rect').attributes().fill, undefined);
  assert.equal(session.undo(), 'undone: counted edit');
});

test('two matching handlers are rejected before touching the candidate', async () => {
  const { session } = await setup();
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new DemoAttributeHandler());
  const other: AttributeHandler = {
    name: 'zzz-attributes',
    handles: (shape, attribute) => shape.kind === 'demo-box' && attribute === 'fill',
    apply: () => ({}),
  };
  handlers.register(other);
  assert.throws(
    () => session.edit(editAttribute(handlers, 'box1', 'fill', 'red')),
    /ambiguous attribute handlers for box1\.fill: demo-attributes, zzz-attributes/,
  );
  assert.equal(session.document().require('box1-rect').attributes().fill, undefined);
});

test('handles observes the request before any default fallback', async () => {
  const { session } = await setup();
  const seen: string[] = [];
  const inspecting: AttributeHandler = {
    name: 'inspecting',
    handles: (shape, attribute) => {
      seen.push(`${shape.id}:${attribute}`);
      return false;
    },
    apply: () => ({}),
  };
  const handlers = new AttributeHandlerRegistry();
  handlers.register(inspecting);
  session.edit(editAttribute(handlers, 'box1', 'fill', 'red'));
  assert.deepEqual(seen, ['box1:fill']);
  assert.equal(session.document().require('box1').attributes().fill, 'red');
  assert.equal(session.document().require('box1-rect').attributes().fill, undefined);
});
