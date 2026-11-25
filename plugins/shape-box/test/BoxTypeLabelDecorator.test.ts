import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgDocument, TreeDecoratorRegistry, TreePresenter } from '@svgframe/core';
import { BoxShape, BoxTypeLabelDecorator } from '../index.js';
import { TestShapeService } from './TestShapeService.js';

function scene(): { document: SvgDocument; box: BoxShape } {
  const document = new SvgDocument(800, 600);
  const created = new TestShapeService().create({
    type: 'box',
    id: 'n1',
    parameters: ['120', '100', '160', '60', '开始'],
  });
  assert.ok(created instanceof BoxShape);
  document.add(created);
  return { document, box: created };
}

test('the decorator labels only box rows with (box)', () => {
  const { document, box } = scene();
  const decorator = new BoxTypeLabelDecorator();
  assert.equal(decorator.name, 'box-type-label');
  assert.equal(
    decorator.decorate({ document, node: box, parent: document.root, depth: 1 }),
    '(box)',
  );
  assert.equal(decorator.decorate({ document, node: box.rect(), parent: box, depth: 2 }), null);
  assert.equal(decorator.decorate({ document, node: document.root, parent: null, depth: 0 }), null);
});

test('the tree presenter appends exactly one (box) suffix and keeps other rows bare', () => {
  const { document } = scene();
  const decorators = new TreeDecoratorRegistry();
  decorators.register(new BoxTypeLabelDecorator());
  const lines = new TreePresenter(decorators).tree(document);
  assert.deepEqual(lines, [
    'svg (800x600)',
    '└── g#n1 (box)',
    '    ├── rect#n1-rect',
    '    └── text#n1-label',
  ]);
  const plain = new TreePresenter(new TreeDecoratorRegistry()).tree(document);
  assert.deepEqual(plain, [
    'svg (800x600)',
    '└── g#n1',
    '    ├── rect#n1-rect',
    '    └── text#n1-label',
  ]);
});

test('two decorator instances share no state', () => {
  const first = new BoxTypeLabelDecorator();
  const second = new BoxTypeLabelDecorator();
  const { document, box } = scene();
  const row = { document, node: box, parent: document.root, depth: 1 };
  assert.equal(first.decorate(row), '(box)');
  assert.equal(second.decorate(row), '(box)');
});
