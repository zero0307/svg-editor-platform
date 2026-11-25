import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgDocument } from '@svgframe/core';
import { contentSnapshot, dirtyIds } from '../index.js';
import { box, group, label, rect, scene } from './Scenes.js';
import { TestShape } from './TestShape.js';
import type { ContainerShape } from '@svgframe/core';

function ids(document: SvgDocument): readonly string[] {
  return [...contentSnapshot(document).own.keys()].sort();
}

function dirty(document: SvgDocument, baseline: SvgDocument): readonly string[] {
  return [...dirtyIds(document, contentSnapshot(baseline))].sort();
}

test('the same content rebuilt as a new object graph has identical fingerprints', () => {
  const left = contentSnapshot(scene());
  const right = contentSnapshot(scene());
  assert.deepEqual([...left.own.entries()].sort(), [...right.own.entries()].sort());
  assert.deepEqual([...left.parents.entries()].sort(), [...right.parents.entries()].sort());
  assert.equal(left.canvas, right.canvas);
});

test('attribute insertion order does not matter but the values do', () => {
  const first = new SvgDocument();
  const one = new TestShape('s1', 'rect', { x: 0, y: 0, width: 1, height: 1 });
  one.setAttribute('fill', 'red');
  one.preserveAttribute('data-kind', 'box');
  first.add(one);
  const second = new SvgDocument();
  const other = new TestShape('s1', 'rect', { x: 0, y: 0, width: 1, height: 1 });
  other.preserveAttribute('data-kind', 'box');
  other.setAttribute('fill', 'red');
  second.add(other);
  assert.equal(contentSnapshot(first).own.get('s1'), contentSnapshot(second).own.get('s1'));
  other.setAttribute('fill', 'blue');
  assert.notEqual(contentSnapshot(first).own.get('s1'), contentSnapshot(second).own.get('s1'));
  other.setAttribute('fill', 'red');
  other.preserveAttribute('data-kind', 'other');
  assert.notEqual(contentSnapshot(first).own.get('s1'), contentSnapshot(second).own.get('s1'));
});

test('text, geometry and parent identity are part of the persisted projection', () => {
  const emptyText = new SvgDocument();
  emptyText.add(label('t1', ''));
  const change = emptyText.clone();
  (change.require('t1') as TestShape).setAttribute('text', 'a');
  assert.notEqual(contentSnapshot(emptyText).own.get('t1'), contentSnapshot(change).own.get('t1'));

  const first = new SvgDocument();
  const left = group('g1');
  first.add(left);
  first.add(rect('r1'), left);
  const second = new SvgDocument();
  const right = group('g2');
  second.add(right);
  second.add(rect('r1'), right);
  assert.notEqual(contentSnapshot(first).own.get('r1'), contentSnapshot(second).own.get('r1'));

  const resized = first.clone();
  assert.equal(contentSnapshot(first).own.get('r1'), contentSnapshot(resized).own.get('r1'));
  resized.add(rect('r9'), resized.require('g1') as ContainerShape);
  assert.notEqual(contentSnapshot(first).own.get('g1'), contentSnapshot(resized).own.get('g1'));
});

test('child order and membership belong to the parent fingerprint', () => {
  const forward = new SvgDocument();
  const parent = group('g1');
  forward.add(parent);
  forward.add(rect('a'), parent);
  forward.add(rect('b'), parent);
  const backward = new SvgDocument();
  const reversed = group('g1');
  backward.add(reversed);
  backward.add(rect('b'), reversed);
  backward.add(rect('a'), reversed);
  assert.notEqual(contentSnapshot(forward).own.get('g1'), contentSnapshot(backward).own.get('g1'));
  assert.equal(contentSnapshot(forward).own.get('a'), contentSnapshot(backward).own.get('a'));
});

test('dirty ids cover changed nodes, their ancestors, deletions, additions and canvas', () => {
  const baseline = scene();
  assert.deepEqual(dirty(scene(), baseline), []);

  const changed = baseline.clone();
  (changed.require('r1') as TestShape).setAttribute('fill', 'red');
  assert.deepEqual(dirty(changed, baseline), ['canvas', 'g1', 'r1']);

  const leafDeleted = baseline.clone();
  const r2 = leafDeleted.require('r2');
  r2.parent!.remove(r2);
  assert.deepEqual(dirty(leafDeleted, baseline), ['canvas', 'g1']);

  const subtreeDeleted = baseline.clone();
  const g1 = subtreeDeleted.require('g1');
  g1.parent!.remove(g1);
  assert.deepEqual(dirty(subtreeDeleted, baseline), ['canvas', 'g1']);

  const added = baseline.clone();
  added.add(rect('r3'), added.require('g1') as ContainerShape);
  assert.deepEqual(dirty(added, baseline), ['canvas', 'g1', 'r3']);

  const resized = baseline.clone();
  resized.resize(400, 300);
  assert.deepEqual(dirty(resized, baseline), ['canvas']);
});

test('a box marker and its parts participate in the projection', () => {
  const baseline = new SvgDocument();
  const n1 = box('n1');
  baseline.add(n1);
  assert.deepEqual(ids(baseline), ['n1', 'n1-label', 'n1-rect']);
  const changed = baseline.clone();
  (changed.require('n1-rect') as TestShape).setAttribute('fill', 'red');
  assert.deepEqual(dirty(changed, baseline), ['canvas', 'n1', 'n1-rect']);
});
