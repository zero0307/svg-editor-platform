import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttributeHandlerConflictError,
  AttributeHandlerRegistry,
  FakeShapeCreationService,
  FaultyAttributeHandler,
  SvgDocument,
} from '../index.js';
import type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  ReadonlyShape,
} from '../index.js';
import { DemoAttributeHandler } from './support/DemoAttributeHandler.js';
import { DemoBoxProvider } from './support/DemoBoxProvider.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

const buildDocument = (): SvgDocument => {
  const shapes = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  const document = new SvgDocument();
  document.add(
    new DemoBoxProvider().create({ type: 'demo-box', id: 'box1', parameters: ['label'] }, shapes),
  );
  return document;
};

/** Contract of the attribute dispatcher: reject ambiguity before mutating. */
const selectSingle = (
  targetId: string,
  attribute: string,
  matches: readonly AttributeHandler[],
): AttributeHandler | undefined => {
  if (matches.length > 1)
    throw new AttributeHandlerConflictError(
      targetId,
      attribute,
      matches.map((handler) => handler.name),
    );
  return matches[0];
};

test('handles is a pure query over a read-only shape', () => {
  const candidate = buildDocument().clone();
  const target: ReadonlyShape = candidate.require('box1');
  const handler = new DemoAttributeHandler();
  const before = JSON.stringify(candidate.require('box1-rect').attributes());
  assert.equal(handler.handles(target, 'fill'), true);
  assert.equal(JSON.stringify(candidate.require('box1-rect').attributes()), before);
  assert.equal(handler.handles(target, 'stroke'), false);
  assert.equal(handler.handles(candidate.require('box1-rect'), 'fill'), false);
});

test('apply modifies only the detached candidate document', () => {
  const document = buildDocument();
  const candidate = document.clone();
  const context: AttributeEditContext = { document: candidate };
  const request: AttributeRequest = { targetId: 'box1', attribute: 'fill', value: 'red' };
  const result = new DemoAttributeHandler().apply(context, request);
  assert.equal(result.message, 'fill=red');
  assert.equal(candidate.require('box1-rect').attributes().fill, 'red');
  assert.equal(document.require('box1-rect').attributes().fill, undefined);
  assert.throws(() => candidate.require('missing'), /no such shape/);
});

test('two matching handlers are rejected before any mutation', () => {
  const candidate = buildDocument().clone();
  const target = candidate.require('box1');
  const other: AttributeHandler = {
    name: 'other-attributes',
    handles: (shape, attribute) => shape.kind === 'demo-box' && attribute === 'fill',
    apply: () => ({}),
  };
  const registry = new AttributeHandlerRegistry();
  registry.register(new DemoAttributeHandler());
  registry.register(other);
  const matches = registry.entries().filter((handler) => handler.handles(target, 'fill'));
  assert.equal(matches.length, 2);
  const before = JSON.stringify(candidate.require('box1-rect').attributes());
  assert.throws(
    () => selectSingle(target.id, 'fill', matches),
    (error: unknown) => {
      if (!(error instanceof AttributeHandlerConflictError)) return false;
      assert.deepEqual(error.handlers, ['demo-attributes', 'other-attributes']);
      assert.match(
        error.message,
        /ambiguous attribute handlers for box1\.fill: demo-attributes, other-attributes/,
      );
      return true;
    },
  );
  assert.equal(JSON.stringify(candidate.require('box1-rect').attributes()), before);
});

test('no match falls back to the default attribute rules', () => {
  const candidate = buildDocument().clone();
  const target = candidate.require('box1');
  assert.equal(selectSingle(target.id, 'fill', []), undefined);
  target.setAttribute('fill', 'blue');
  assert.equal(target.attributes().fill, 'blue');
  assert.throws(() => target.setAttribute('label', 'x'), /unknown attribute: label/);
});

test('a matching handler failure propagates without default fallback', () => {
  const candidate = buildDocument().clone();
  const handler = new FaultyAttributeHandler('broken');
  assert.equal(handler.handles(candidate.require('box1'), 'fill'), true);
  assert.throws(
    () =>
      handler.apply({ document: candidate }, { targetId: 'box1', attribute: 'fill', value: 'red' }),
    /attribute handler failed: broken/,
  );
  assert.equal(candidate.require('box1-rect').attributes().fill, undefined);

  const brokenQuery = new FaultyAttributeHandler('broken-query', 'handles');
  assert.throws(
    () => brokenQuery.handles(candidate.require('box1'), 'fill'),
    /attribute handler failed/,
  );
});
