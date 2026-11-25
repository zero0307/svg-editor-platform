import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttributeEditingService,
  AttributeHandlerRegistry,
  CreateAction,
  DeleteAction,
  FakeShapeCreationService,
  Group,
  StructureService,
  SvgDocument,
} from '../index.js';
import { DemoBoxProvider } from './support/DemoBoxProvider.js';
import { DemoBoxShape } from './support/DemoBoxShape.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';
import { ProtectedBoxShape } from './support/ProtectedBoxShape.js';

const createShapes = (): FakeShapeCreationService => {
  const shapes = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  shapes.register('demo-box', (request) => new DemoBoxProvider().create(request, shapes));
  return shapes;
};

const createBoxDocument = (): SvgDocument => {
  const document = new SvgDocument();
  document.add(
    new DemoBoxProvider().create({ type: 'demo-box', id: 'n1', parameters: [] }, createShapes()),
  );
  return document;
};

test('plain shapes expose no creation parts and keep the Phase 1 create bytes', () => {
  const shapes = createShapes();
  const document = new SvgDocument();
  const message = new CreateAction(shapes, 'rect', 'r', ['0', '0', '1', '1']).apply(document);
  assert.equal(message, 'rect#r created');
  assert.deepEqual(new FakeLeafShape('r').creationParts(), []);
});

test('a composite kind annotates create with its public creation parts', () => {
  const document = new SvgDocument();
  const box = new DemoBoxProvider().create(
    { type: 'demo-box', id: 'n1', parameters: [] },
    createShapes(),
  );
  document.add(box);
  assert.deepEqual(box.creationParts(), ['g#n1', 'rect#n1-rect', 'text#n1-label']);
  assert.equal(
    new CreateAction(createShapes(), 'demo-box', 'n2', []).apply(document),
    'demo-box#n2 created (g#n2 + rect#n2-rect + text#n2-label)',
  );
});

test('delete and the default attribute feedback use the domain kind', () => {
  const document = createBoxDocument();
  assert.equal(
    new DeleteAction(new StructureService(), 'n1').apply(document),
    'demo-box#n1 deleted',
  );
  const attributeDocument = createBoxDocument();
  const message = new AttributeEditingService(new AttributeHandlerRegistry()).apply(
    attributeDocument,
    {
      targetId: 'n1',
      attribute: 'fill',
      value: 'red',
    },
  );
  assert.equal(message, 'demo-box#n1 updated: fill="red"');
});

test('ungroup rejects composite shapes with the dedicated wording', () => {
  const composite = new ProtectedBoxShape('n1');
  composite.insert(new FakeLeafShape('n1-rect', 'rect'));
  composite.insert(new FakeLeafShape('n1-label', 'text'));
  const document = new SvgDocument();
  document.add(composite);
  assert.throws(
    () => new StructureService().ungroup(document, 'n1'),
    /cannot ungroup composite shape: n1/,
  );

  const ordinary = new SvgDocument();
  ordinary.add(new Group('g1'));
  assert.throws(
    () => new StructureService().ungroup(ordinary, 'g1'),
    /cannot ungroup top-level container: g1/,
  );
  assert.ok(document.require('n1') instanceof DemoBoxShape);
});
