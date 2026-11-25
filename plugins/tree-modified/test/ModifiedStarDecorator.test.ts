import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgDocument, TreeDecoratorRegistry, TreePresenter } from '@svgframe/core';
import { ModifiedStarDecorator } from '../index.js';
import { BoxLabelStub } from './BoxLabelStub.js';
import {
  box,
  canvasChanged,
  edited,
  group,
  initialized,
  label,
  read,
  rect,
  redone,
  saved,
  scene,
  undone,
} from './Scenes.js';
import { TestShape } from './TestShape.js';
import type { ContainerShape, TreeDecorator } from '@svgframe/core';

function treeLines(document: SvgDocument, ...decorators: TreeDecorator[]): readonly string[] {
  const registry = new TreeDecoratorRegistry();
  for (const decorator of decorators) registry.register(decorator);
  return new TreePresenter(registry).tree(document);
}

function cleanLines(document: SvgDocument): readonly string[] {
  return treeLines(document);
}

const CLEAN_SCENE = [
  'svg (800x600)',
  '├── g#g1',
  '│   ├── rect#r1',
  '│   └── rect#r2',
  '└── g#g2',
  '    └── text#t1',
];

test('a fresh empty document stays clean after init', () => {
  const decorator = new ModifiedStarDecorator();
  const empty = new SvgDocument(800, 600);
  decorator.onEvent(initialized(empty));
  assert.deepEqual(treeLines(empty, decorator), ['svg (800x600)']);
});

test('new content after the empty baseline marks every row and the root', () => {
  const decorator = new ModifiedStarDecorator();
  decorator.onEvent(initialized(new SvgDocument(800, 600)));
  const current = scene();
  assert.deepEqual(treeLines(current, decorator), [
    'svg (800x600) *',
    '├── g#g1 *',
    '│   ├── rect#r1 *',
    '│   └── rect#r2 *',
    '└── g#g2 *',
    '    └── text#t1 *',
  ]);
});

test('a successful save clears every star and keeps the base bytes', () => {
  const decorator = new ModifiedStarDecorator();
  const document = scene();
  decorator.onEvent(initialized(new SvgDocument(800, 600)));
  decorator.onEvent(saved(document));
  assert.deepEqual(treeLines(document, decorator), CLEAN_SCENE);
  assert.deepEqual(treeLines(document, decorator), cleanLines(document));
});

test('a leaf edit marks only the leaf, its ancestors and the root', () => {
  const decorator = new ModifiedStarDecorator();
  const document = scene();
  decorator.onEvent(saved(document));
  const changed = document.clone();
  (changed.require('r1') as TestShape).setAttribute('fill', 'red');
  decorator.onEvent(edited(changed));
  assert.deepEqual(treeLines(changed, decorator), [
    'svg (800x600) *',
    '├── g#g1 *',
    '│   ├── rect#r1 *',
    '│   └── rect#r2',
    '└── g#g2',
    '    └── text#t1',
  ]);
});

test('undo back to the saved content clears, redo marks again', () => {
  const decorator = new ModifiedStarDecorator();
  const savedDocument = scene();
  decorator.onEvent(saved(savedDocument));
  const changed = savedDocument.clone();
  (changed.require('t1') as TestShape).setAttribute('text', 'v2');
  decorator.onEvent(edited(changed));
  assert.ok(treeLines(changed, decorator).some((line) => line.includes('text#t1 *')));
  const restored = scene();
  decorator.onEvent(undone(restored));
  assert.deepEqual(treeLines(restored, decorator), CLEAN_SCENE);
  const redoneDocument = changed.clone();
  decorator.onEvent(redone(redoneDocument));
  assert.ok(treeLines(redoneDocument, decorator).some((line) => line.includes('text#t1 *')));
});

test('deleting a leaf uses the baseline parent chain and never stars its siblings', () => {
  const decorator = new ModifiedStarDecorator();
  const baseline = scene();
  decorator.onEvent(saved(baseline));
  const current = scene();
  const removed = current.require('r2');
  removed.parent!.remove(removed);
  decorator.onEvent(edited(current));
  assert.deepEqual(treeLines(current, decorator), [
    'svg (800x600) *',
    '├── g#g1 *',
    '│   └── rect#r1',
    '└── g#g2',
    '    └── text#t1',
  ]);
});

test('deleting a whole subtree stars the root only among remaining rows', () => {
  const decorator = new ModifiedStarDecorator();
  decorator.onEvent(saved(scene()));
  const current = scene();
  const g1 = current.require('g1');
  g1.parent!.remove(g1);
  decorator.onEvent(edited(current));
  assert.deepEqual(treeLines(current, decorator), [
    'svg (800x600) *',
    '└── g#g2',
    '    └── text#t1',
  ]);
});

test('reordering children stars the parent and root, not the children', () => {
  const decorator = new ModifiedStarDecorator();
  decorator.onEvent(saved(scene()));
  const reordered = new SvgDocument(800, 600);
  const g1 = group('g1');
  reordered.add(g1);
  reordered.add(rect('r2', 20), g1);
  reordered.add(rect('r1'), g1);
  const g2 = group('g2');
  reordered.add(g2);
  reordered.add(label('t1'), g2);
  decorator.onEvent(edited(reordered));
  assert.deepEqual(treeLines(reordered, decorator), [
    'svg (800x600) *',
    '├── g#g1 *',
    '│   ├── rect#r2',
    '│   └── rect#r1',
    '└── g#g2',
    '    └── text#t1',
  ]);
});

test('moving a child between containers stars both containers and the child', () => {
  const decorator = new ModifiedStarDecorator();
  decorator.onEvent(saved(scene()));
  const moved = new SvgDocument(800, 600);
  const g1 = group('g1');
  moved.add(g1);
  moved.add(rect('r1'), g1);
  const g2 = group('g2');
  moved.add(g2);
  moved.add(label('t1'), g2);
  moved.add(rect('r2', 20), g2);
  decorator.onEvent(edited(moved));
  assert.deepEqual(treeLines(moved, decorator), [
    'svg (800x600) *',
    '├── g#g1 *',
    '│   └── rect#r1',
    '└── g#g2 *',
    '    ├── text#t1',
    '    └── rect#r2 *',
  ]);
});

test('a canvas change stars only the root row', () => {
  const decorator = new ModifiedStarDecorator();
  const document = scene();
  decorator.onEvent(saved(document));
  const resized = document.clone();
  resized.resize(400, 300);
  decorator.onEvent(canvasChanged(resized));
  assert.deepEqual(treeLines(resized, decorator), [
    'svg (400x300) *',
    '├── g#g1',
    '│   ├── rect#r1',
    '│   └── rect#r2',
    '└── g#g2',
    '    └── text#t1',
  ]);
});

test('a read resets the baseline, while failed edits and saves leave it untouched', () => {
  const decorator = new ModifiedStarDecorator();
  decorator.onEvent(saved(scene()));
  const readDocument = new SvgDocument(400, 300);
  readDocument.add(rect('r9'));
  decorator.onEvent(read(readDocument));
  assert.deepEqual(treeLines(readDocument, decorator), ['svg (400x300)', '└── rect#r9']);

  const failedAttempt = readDocument.clone();
  (failedAttempt.require('r9') as TestShape).setAttribute('fill', 'red');
  assert.ok(treeLines(failedAttempt, decorator).some((line) => line.includes(' *')));
  assert.deepEqual(treeLines(readDocument, decorator), ['svg (400x300)', '└── rect#r9']);
});

test('a new node stars itself and its ancestors after the save baseline', () => {
  const decorator = new ModifiedStarDecorator();
  const document = scene();
  decorator.onEvent(saved(document));
  const added = document.clone();
  added.add(rect('r3'), added.require('g1') as ContainerShape);
  decorator.onEvent(edited(added));
  assert.deepEqual(treeLines(added, decorator), [
    'svg (800x600) *',
    '├── g#g1 *',
    '│   ├── rect#r1',
    '│   ├── rect#r2',
    '│   └── rect#r3 *',
    '└── g#g2',
    '    └── text#t1',
  ]);
});

test('two decorator instances keep independent baselines', () => {
  const first = new ModifiedStarDecorator();
  const second = new ModifiedStarDecorator();
  const firstDocument = scene();
  first.onEvent(saved(firstDocument));
  const secondDocument = new SvgDocument(400, 300);
  secondDocument.add(rect('only'));
  second.onEvent(saved(secondDocument));

  const changed = firstDocument.clone();
  (changed.require('r1') as TestShape).setAttribute('fill', 'red');
  first.onEvent(edited(changed));
  assert.ok(treeLines(changed, first).some((line) => line.includes(' *')));
  assert.deepEqual(treeLines(secondDocument, second), ['svg (400x300)', '└── rect#only']);

  first.onEvent(saved(firstDocument));
  assert.deepEqual(treeLines(secondDocument, second), ['svg (400x300)', '└── rect#only']);
});

test('box and modified labels compose in registration order with one space each', () => {
  const decorator = new ModifiedStarDecorator();
  const baseline = new SvgDocument(800, 600);
  baseline.add(box('n1', 'start'));
  decorator.onEvent(saved(baseline));

  const current = baseline.clone();
  (current.require('n1-rect') as TestShape).setAttribute('fill', 'red');
  decorator.onEvent(edited(current));
  const lines = treeLines(current, new BoxLabelStub(), decorator);
  assert.deepEqual(lines, [
    'svg (800x600) *',
    '└── g#n1 (box) *',
    '    ├── rect#n1-rect *',
    '    └── text#n1-label',
  ]);
  assert.deepEqual(treeLines(baseline, new BoxLabelStub(), decorator), [
    'svg (800x600)',
    '└── g#n1 (box)',
    '    ├── rect#n1-rect',
    '    └── text#n1-label',
  ]);
});

test('a clean modified decorator contributes no bytes and no trailing spaces', () => {
  const decorator = new ModifiedStarDecorator();
  const document = scene();
  decorator.onEvent(saved(document));
  const decorated = treeLines(document, decorator);
  assert.deepEqual(decorated, cleanLines(document));
  assert.equal(decorated.join('\n').includes(' *'), false);
  for (const line of decorated) assert.equal(line.endsWith(' '), false);
});
