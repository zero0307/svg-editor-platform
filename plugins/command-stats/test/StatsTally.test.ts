import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, SvgDocument } from '@svgframe/core';
import { StatsTally } from '../index.js';
import { FakeBoxShape } from './FakeBoxShape.js';
import { FakeLeafShape } from './FakeLeafShape.js';

function report(document: SvgDocument): string {
  return new StatsTally().report(document);
}

test('stats walks nested containers depth-first and counts leaves in first-appearance order', () => {
  const document = new SvgDocument();
  const group = new Group('g1');
  document.add(group);
  document.add(new FakeLeafShape('a', 'rect'), group);
  document.add(new FakeLeafShape('b', 'circle'), group);
  const box = new FakeBoxShape('n1');
  document.add(box);
  document.add(new FakeLeafShape('n1-rect', 'rect'), box);
  document.add(new FakeLeafShape('n1-label', 'text'), box);
  document.add(new FakeLeafShape('t', 'text'));
  assert.equal(
    report(document),
    'rect: 2  circle: 1  text: 2  (total 5, containers 2)',
    'g and box are containers; leaves inside them are still counted',
  );
});

test('stats keeps the first-appearance order instead of sorting type names', () => {
  const document = new SvgDocument();
  document.add(new FakeLeafShape('a', 'text'));
  document.add(new FakeLeafShape('b', 'rect'));
  document.add(new FakeLeafShape('c', 'text'));
  document.add(new FakeLeafShape('d', 'circle'));
  assert.equal(report(document), 'text: 2  rect: 1  circle: 1  (total 4, containers 0)');
});

test('stats does not count the root SVG and handles nested containers', () => {
  const document = new SvgDocument();
  const outer = new Group('outer');
  const inner = new Group('inner');
  document.add(outer);
  document.add(inner, outer);
  document.add(new FakeLeafShape('r', 'rect'), inner);
  assert.equal(report(document), 'rect: 1  (total 1, containers 2)');
});

test('an empty document reports zero leaves and zero containers', () => {
  assert.equal(report(new SvgDocument()), '(total 0, containers 0)');
});

test('an empty container still counts as a container', () => {
  const document = new SvgDocument();
  document.add(new Group('g1'));
  assert.equal(report(document), '(total 0, containers 1)');
});

test('box internals count as leaves under their own kinds', () => {
  const document = new SvgDocument();
  const box = new FakeBoxShape('n1');
  document.add(box);
  document.add(new FakeLeafShape('n1-rect', 'rect'), box);
  document.add(new FakeLeafShape('n1-label', 'text'), box);
  assert.equal(report(document), 'rect: 1  text: 1  (total 2, containers 1)');
});
