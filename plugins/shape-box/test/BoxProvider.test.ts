import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxProvider, BoxShape } from '../index.js';
import { TestShapeService, testRestorer, view } from './TestShapeService.js';

test('create builds both role parts through the public creation service', () => {
  const service = new TestShapeService();
  const created = service.create({
    type: 'box',
    id: 'n1',
    parameters: ['120', '100', '160', '60', '开始'],
  });
  assert.ok(created instanceof BoxShape);
  assert.deepEqual(
    created.children().map((child) => child.id),
    ['n1-rect', 'n1-label'],
  );
  assert.deepEqual(created.rect().geometry(), {
    x: '120',
    y: '100',
    width: '160',
    height: '60',
  });
  assert.equal(created.rect().attributes().fill, '#4a90d9');
  assert.deepEqual(created.label().geometry(), { x: '140', y: '135' });
  assert.equal(created.label().textContent(), '开始');
  assert.deepEqual(
    service.parts.requests.map((request) => `${request.type}:${request.id}`),
    ['rect:n1-rect', 'text:n1-label'],
  );
  assert.deepEqual(service.parts.requests[0]?.parameters, ['120', '100', '160', '60', '#4a90d9']);
  assert.deepEqual(service.parts.requests[1]?.parameters, ['140', '135', '开始']);
});

test('create validates its own parameter grammar', () => {
  const provider = new BoxProvider();
  const service = new TestShapeService();
  assert.throws(
    () => provider.create({ type: 'box', id: 'n1', parameters: ['1', '2', '3', '4'] }, service),
    /invalid parameters for box/,
  );
  assert.throws(
    () =>
      provider.create(
        { type: 'box', id: 'n1', parameters: ['1', '2', '3', '4', 'x', 'y'] },
        service,
      ),
    /invalid parameters for box/,
  );
  assert.throws(
    () =>
      provider.create({ type: 'box', id: 'n1', parameters: ['1', 'nope', '3', '4', 'x'] }, service),
    /invalid number for parameter 2: nope/,
  );
});

test('matches only the explicit g data-kind=box marker', () => {
  const provider = new BoxProvider();
  assert.equal(provider.matches(view('g', 'n1', { 'data-kind': 'box' })), true);
  assert.equal(provider.matches(view('g', 'g1')), false);
  assert.equal(provider.matches(view('g', 'n1', { 'data-kind': 'other' })), false);
  assert.equal(provider.matches(view('rect', 'n1', { 'data-kind': 'box' })), false);
});

test('restore rebuilds the complete subtree including extra children and nested boxes', () => {
  const provider = new BoxProvider();
  const restorer = testRestorer(provider);
  const element = view('g', 'n1', { 'data-kind': 'box', fill: '#eeeeee' }, [
    view('rect', 'n1-rect', { x: '10', y: '20', width: '100', height: '40' }),
    view('text', 'n1-label', { x: '30', y: '45' }, [], '开始'),
    view('rect', 'n1-extra', { x: '1', y: '2', width: '3', height: '4' }),
    view('g', 'n2', { 'data-kind': 'box' }, [
      view('rect', 'n2-rect', { x: '0', y: '0', width: '10', height: '10' }),
      view('text', 'n2-label', { x: '2', y: '5' }, [], '内层'),
    ]),
  ]);
  const restored = provider.restore(element, restorer);
  assert.ok(restored instanceof BoxShape);
  assert.equal(restored.attributes()['data-kind'], 'box');
  assert.equal(restored.attributes().fill, '#eeeeee');
  assert.deepEqual(
    restored.children().map((child) => child.id),
    ['n1-rect', 'n1-label', 'n1-extra', 'n2'],
  );
  assert.deepEqual(restored.rect().geometry(), { x: '10', y: '20', width: '100', height: '40' });
  assert.equal(restored.label().textContent(), '开始');
  const nested = restored.children().find((child) => child.id === 'n2');
  assert.ok(nested instanceof BoxShape);
  assert.equal(nested.label().textContent(), '内层');
});

test('restore never re-applies the container world transform to its subtree', () => {
  const provider = new BoxProvider();
  const restorer = testRestorer(provider);
  const element = view(
    'g',
    'n1',
    { 'data-kind': 'box' },
    [
      view('rect', 'n1-rect', { x: '10', y: '20', width: '100', height: '40' }),
      view('text', 'n1-label', { x: '30', y: '45' }, [], '开始'),
    ],
    null,
    { scale: 2, translateX: 5, translateY: 7 },
  );
  const restored = provider.restore(element, restorer);
  assert.ok(restored instanceof BoxShape);
  assert.deepEqual(restored.rect().geometry(), { x: '10', y: '20', width: '100', height: '40' });
  assert.deepEqual(restored.label().geometry(), { x: '30', y: '45' });
});

test('restore rejects incomplete or wrongly typed boxes and a missing id', () => {
  const provider = new BoxProvider();
  const restorer = testRestorer(provider);
  assert.throws(
    () =>
      provider.restore(
        view('g', 'n1', { 'data-kind': 'box' }, [
          view('rect', 'n1-rect', { x: '0', y: '0', width: '1', height: '1' }),
        ]),
        restorer,
      ),
    /incomplete box: n1 is missing n1-label/,
  );
  assert.throws(
    () =>
      provider.restore(
        view('g', 'n1', { 'data-kind': 'box' }, [
          view('rect', 'n1-rect', { x: '0', y: '0', width: '1', height: '1' }),
          view('rect', 'n1-label', { x: '0', y: '0', width: '1', height: '1' }),
        ]),
        restorer,
      ),
    /invalid box: n1-label must be a <text> part/,
  );
  assert.throws(
    () => provider.restore(view('g', null, { 'data-kind': 'box' }), restorer),
    /invalid box structure: missing id/,
  );
});
