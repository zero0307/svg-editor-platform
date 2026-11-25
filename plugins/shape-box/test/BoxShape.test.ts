import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxShape } from '../index.js';
import { TestLeafShape } from './TestLeafShape.js';
import { TestShapeService } from './TestShapeService.js';

function box(id = 'n1', x = 120, y = 100, w = 160, h = 60, label = '开始'): BoxShape {
  const created = new TestShapeService().create({
    type: 'box',
    id,
    parameters: [String(x), String(y), String(w), String(h), label],
  });
  assert.ok(created instanceof BoxShape);
  return created;
}

test('a box is a g container with kind box and a data-kind marker', () => {
  const shape = box();
  assert.equal(shape.tag, 'g');
  assert.equal(shape.kind, 'box');
  assert.equal(shape.attributes()['data-kind'], 'box');
  assert.deepEqual(
    shape.children().map((child) => child.id),
    ['n1-rect', 'n1-label'],
  );
  assert.equal(shape.rect().tag, 'rect');
  assert.equal(shape.label().tag, 'text');
  assert.equal(shape.label().textContent(), '开始');
});

test('clone keeps the plugin type and rebinds copied parts without sharing children', () => {
  const original = box();
  const copy = original.clone();
  assert.ok(copy instanceof BoxShape, 'newContainer() must retain the box type');
  assert.equal(copy.kind, 'box');
  assert.equal(copy.attributes()['data-kind'], 'box');
  assert.equal(copy.rect().id, 'n1-rect');
  assert.equal(copy.label().id, 'n1-label');
  assert.equal(copy.rect().parent, copy);
  assert.notEqual(copy.rect(), original.rect());
  copy.rect().setAttribute('fill', '#000000');
  assert.equal(original.rect().attributes().fill, '#4a90d9');
});

test('a cloned box keeps nested boxes and extra children as ordinary members', () => {
  const outer = box('n1');
  const inner = box('n2', 200, 40, 80, 30, '内层');
  outer.insert(inner);
  outer.insert(new TestLeafShape('note', 'rect', { x: 0, y: 0, width: 5, height: 5 }));
  outer.validateInvariant();
  const copy = outer.clone();
  assert.ok(copy instanceof BoxShape);
  const nested = copy.children().find((child) => child.id === 'n2');
  assert.ok(nested instanceof BoxShape);
  assert.equal(nested.kind, 'box');
  assert.equal(copy.children().find((child) => child.id === 'note')?.tag, 'rect');
  copy.remove(copy.children().find((child) => child.id === 'note')!);
  assert.equal(
    outer.children().some((child) => child.id === 'note'),
    true,
  );
});

test('move and scale use the container semantics of all members', () => {
  const shape = box();
  shape.move(10, 20);
  assert.deepEqual(shape.rect().geometry(), { x: '130', y: '120', width: '160', height: '60' });
  assert.deepEqual(shape.label().geometry(), { x: '150', y: '155' });
  shape.scale(2);
  assert.deepEqual(shape.rect().geometry(), {
    x: '260',
    y: '240',
    width: '320',
    height: '120',
  });
  assert.deepEqual(shape.label().geometry(), { x: '300', y: '310' });
});

test('structure policy protects only the necessary parts and refuses ungroup', () => {
  const shape = box();
  assert.equal(shape.canRemoveChild(shape.rect()), false);
  assert.equal(shape.canRemoveChild(shape.label()), false);
  const extra = new TestLeafShape('extra', 'rect');
  shape.insert(extra);
  assert.equal(shape.canRemoveChild(extra), true);
  assert.equal(shape.canUngroup(), false);
});

test('the invariant rejects a missing or wrongly typed necessary part', () => {
  const missing = box();
  missing.remove(missing.rect());
  assert.throws(() => missing.validateInvariant(), /incomplete box: n1 is missing n1-rect/);

  const wrong = new BoxShape('n1');
  wrong.insert(new TestLeafShape('n1-rect', 'rect'));
  wrong.insert(new TestLeafShape('n1-label', 'rect'));
  assert.throws(() => wrong.validateInvariant(), /invalid box: n1-label must be a <text> part/);

  const complete = box();
  complete.validateInvariant();
});
