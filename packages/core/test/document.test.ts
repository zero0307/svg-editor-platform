import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, SvgDocument } from '../index.js';
import type { ReadonlyDocument } from '../index.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

test('document keeps Phase 1 defaults and id rules', () => {
  const document = new SvgDocument();
  assert.equal(document.width, 800);
  assert.equal(document.height, 600);
  assert.equal(document.root.id, 'canvas');
  assert.equal(document.all().length, 0);
  assert.throws(() => document.require('missing'), /no such shape: missing/);
  assert.throws(() => document.container('missing'), /no such container: missing/);
  assert.throws(() => document.resize(100, 0), /height must be positive/);

  const group = new Group('canvas');
  group.insert(new FakeLeafShape('Title'));
  document.add(group);
  document.add(new FakeLeafShape('title'));
  assert.equal(document.all().length, 3);
  assert.throws(() => document.add(new Group('Title')), /id already exists/);
  assert.throws(() => document.container('title'), /not a container/);
  assert.equal(document.container('canvas').children().length, 1);
});

test('clone copies polymorphic types without sharing mutable children', () => {
  const document = new SvgDocument();
  const group = new Group('g');
  const leaf = new FakeLeafShape('r');
  leaf.setAttribute('fill', 'red');
  group.insert(leaf);
  document.add(group);
  const copy = document.clone();
  assert.notEqual(copy.root, document.root);
  const copiedLeaf = copy.require('r');
  assert.notEqual(copiedLeaf, leaf);
  assert.equal(copiedLeaf.parent, copy.require('g'));
  assert.equal(copiedLeaf.attributes().fill, 'red');
  copiedLeaf.setAttribute('fill', 'blue');
  assert.equal(leaf.attributes().fill, 'red');
  assert.equal(copy.root.children().length, 1);
});

test('validate rejects duplicate ids, broken parent links and invariant failures', () => {
  const duplicate = new SvgDocument();
  const group = new Group('g');
  duplicate.add(group);
  group.insert(new FakeLeafShape('a'));
  group.insert(new FakeLeafShape('a'));
  assert.throws(() => duplicate.validate(), /id already exists: a/);

  const detached = new SvgDocument();
  const leaf = new FakeLeafShape('r');
  detached.add(leaf);
  leaf.attach(null);
  assert.throws(() => detached.validate(), /inconsistent parent link/);

  const invalid = new SvgDocument();
  const broken = new FakeLeafShape('b');
  broken.violation = 'incomplete composite: b';
  invalid.add(broken);
  assert.throws(() => invalid.validate(), /incomplete composite: b/);
});

test('validate enforces the depth limit and structural cycle guard', () => {
  const document = new SvgDocument();
  let parent = new Group('g1');
  document.add(parent);
  for (let index = 2; index <= 130; index++) {
    const child = new Group(`g${index}`);
    parent.insert(child);
    parent = child;
  }
  assert.throws(() => document.validate(), /SVG nesting exceeds 128 levels/);

  const cycle = new Group('outer');
  const inner = new Group('inner');
  cycle.insert(inner);
  cycle.insert(new Group('leaf'));
  assert.throws(() => inner.insert(cycle), /own descendant/);
});

test('the read-only document projection exposes queries only', () => {
  const document = new SvgDocument();
  const group = new Group('g');
  group.insert(new FakeLeafShape('r'));
  document.add(group);
  const readonlyDocument: ReadonlyDocument = document;
  assert.equal(readonlyDocument.require('r').id, 'r');
  assert.equal(readonlyDocument.container('g').children().length, 1);
  assert.equal(readonlyDocument.root.tag, 'g');
  assert.equal(countElements(readonlyDocument), 2);
});

/** Compiles only against the read-only capability; no mutation API is reachable. */
function countElements(document: ReadonlyDocument): number {
  return document.all().length;
}
