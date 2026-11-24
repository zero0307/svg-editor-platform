import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeShapeCreationService,
  FaultyTreeDecorator,
  SvgDocument,
  TreeDecoratorRegistry,
} from '../index.js';
import type { ReadonlyShape, TreeDecorator, TreeRow } from '../index.js';
import { DemoBoxProvider } from './support/DemoBoxProvider.js';
import { DemoTreeDecorator } from './support/DemoTreeDecorator.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

const buildDocument = (): SvgDocument => {
  const shapes = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  const document = new SvgDocument();
  document.add(
    new DemoBoxProvider().create({ type: 'demo-box', id: 'box1', parameters: [] }, shapes),
  );
  return document;
};

const rowFor = (document: SvgDocument, node: ReadonlyShape, depth = 1): TreeRow => ({
  document,
  node,
  parent: node.parent,
  depth,
});

const render = (row: TreeRow, decorators: readonly TreeDecorator[]): string => {
  const base = `${row.node.tag}#${row.node.id}`;
  const suffixes = decorators
    .map((decorator) => decorator.decorate(row))
    .filter((suffix): suffix is string => Boolean(suffix));
  return suffixes.length ? `${base} ${suffixes.join(' ')}` : base;
};

test('zero decorators keep the base row bytes', () => {
  const document = buildDocument();
  const row = rowFor(document, document.require('box1'));
  assert.equal(render(row, []), 'g#box1');
  assert.equal(render(row, [{ name: 'empty', decorate: () => null }]), 'g#box1');
  assert.equal(render(row, [{ name: 'empty', decorate: () => '' }]), 'g#box1');
});

test('a decorator returns a suffix from the read-only row', () => {
  const document = buildDocument();
  const boxRow = rowFor(document, document.require('box1'));
  const leafRow = rowFor(document, document.require('box1-rect'), 2);
  const decorator = new DemoTreeDecorator();
  assert.equal(decorator.decorate(boxRow), '(demo)');
  assert.equal(decorator.decorate(leafRow), null);
  assert.equal(render(boxRow, [decorator]), 'g#box1 (demo)');
});

test('suffix order follows registration order', () => {
  const document = buildDocument();
  const row = rowFor(document, document.require('box1'));
  const registry = new TreeDecoratorRegistry();
  registry.register(new DemoTreeDecorator());
  registry.register({ name: 'blank', decorate: () => '' });
  registry.register({ name: 'extra', decorate: () => '★' });
  assert.deepEqual(registry.names(), ['demo-star', 'blank', 'extra']);
  assert.equal(render(row, registry.entries()), 'g#box1 (demo) ★');
});

test('a failing decorator does not change the document or other suffixes', () => {
  const document = buildDocument();
  const row = rowFor(document, document.require('box1'));
  const before = document.all().map((shape) => shape.id);
  assert.throws(
    () => new FaultyTreeDecorator().decorate(row),
    /tree decorator failed: faulty-decorator/,
  );
  assert.equal(new DemoTreeDecorator().decorate(row), '(demo)');
  assert.deepEqual(
    document.all().map((shape) => shape.id),
    before,
  );
});
