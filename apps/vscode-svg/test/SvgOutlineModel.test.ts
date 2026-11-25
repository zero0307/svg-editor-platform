import test from 'node:test';
import assert from 'node:assert/strict';
import type { OutlineNode } from '../src/OutlineNode.js';
import type { OutlineSpan } from '../src/OutlineSpan.js';
import type { OutlineSymbol } from '../src/OutlineSymbol.js';
import { SvgOutlineModel } from '../src/SvgOutlineModel.js';

const model = new SvgOutlineModel();

const span = (start: number, end: number): OutlineSpan => ({ start, end });

const node = (
  tag: string,
  range: OutlineSpan,
  startTag: OutlineSpan,
  children: readonly OutlineNode[] = [],
  id?: string,
): OutlineNode => ({
  tag,
  id,
  children,
  range,
  startTag,
  name: span(startTag.start + 1, startTag.start + 1 + tag.length),
});

const flatten = (symbols: readonly OutlineSymbol[]): readonly OutlineSymbol[] =>
  symbols.flatMap((symbol) => [symbol, ...flatten(symbol.children)]);

test('shows the root, containers and leaves with tag#id and plain tag labels', () => {
  const [root] = model.build(
    node('svg', span(0, 100), span(0, 20), [
      node(
        'g',
        span(20, 80),
        span(20, 30),
        [
          node('rect', span(30, 50), span(30, 50), [], 'a'),
          node('circle', span(50, 70), span(50, 70)),
        ],
        'flow',
      ),
    ]),
  );
  assert.equal(root?.name, 'svg');
  assert.equal(root?.tag, 'svg');
  assert.equal(root?.container, true);
  assert.deepEqual(
    root?.children.map((child) => child.name),
    ['g#flow'],
  );
  const group = root!.children[0]!;
  assert.equal(group.container, true);
  assert.deepEqual(
    group.children.map((child) => child.name),
    ['rect#a', 'circle'],
  );
  assert.equal(group.children[0]!.container, false);
  assert.equal(group.children[1]!.container, false);
});

test('keeps nested groups and leaves in source order', () => {
  const [root] = model.build(
    node('svg', span(0, 300), span(0, 10), [
      node('g', span(10, 100), span(10, 20), [node('g', span(20, 60), span(20, 30))]),
      node('text', span(100, 200), span(100, 200)),
      node('g', span(200, 280), span(200, 210)),
    ]),
  );
  assert.deepEqual(
    root?.children.map((child) => child.tag),
    ['g', 'text', 'g'],
  );
  assert.deepEqual(
    root?.children[0]!.children.map((child) => child.tag),
    ['g'],
  );
});

test('never invents an id and never needs one', () => {
  const [root] = model.build(
    node('svg', span(0, 50), span(0, 10), [node('unknown:tag', span(10, 40), span(10, 40))]),
  );
  const child = root!.children[0]!;
  assert.equal(child.name, 'unknown:tag');
  assert.equal(child.tag, 'unknown:tag');
});

test('keeps unknown tags and duplicate tag names as labels', () => {
  const [root] = model.build(
    node('svg', span(0, 60), span(0, 10), [
      node('rect', span(10, 20), span(10, 20)),
      node('rect', span(20, 30), span(20, 30)),
      node('rect', span(30, 40), span(30, 40), [], 'r'),
    ]),
  );
  assert.deepEqual(
    root?.children.map((child) => child.name),
    ['rect', 'rect', 'rect#r'],
  );
});

test('selectionRange is the start tag and stays inside the whole-element range', () => {
  const [root] = model.build(
    node('svg', span(4, 200), span(4, 24), [
      node('g', span(30, 150), span(30, 40), [
        node('rect', span(40, 60), span(40, 60), [], 'a'),
        node('g', span(60, 140), span(60, 70), [node('circle', span(70, 90), span(70, 90))]),
      ]),
      node('text', span(150, 190), span(150, 160)),
    ]),
  );
  for (const symbol of flatten([root!])) {
    assert.ok(
      symbol.selectionRange.start >= symbol.range.start,
      `${symbol.name}: selection starts inside range`,
    );
    assert.ok(
      symbol.selectionRange.end <= symbol.range.end,
      `${symbol.name}: selection ends inside range`,
    );
    assert.ok(symbol.selectionRange.start < symbol.selectionRange.end, `${symbol.name}: non-empty`);
  }
  assert.deepEqual(root?.selectionRange, span(4, 24));
  assert.deepEqual(root?.children[0]!.selectionRange, span(30, 40));
});

test('falls back to the whole range when the start tag span is unusable', () => {
  for (const startTag of [span(500, 600), span(20, 20), span(80, 20)]) {
    const [root] = model.build(node('svg', span(10, 80), startTag));
    assert.deepEqual(root?.selectionRange, span(10, 80), `${startTag.start}-${startTag.end}`);
  }
});

test('returns an empty outline when there is no root', () => {
  assert.deepEqual(model.build(undefined), []);
});

test('marks a single-element root as a leaf when it has no children', () => {
  const [root] = model.build(node('svg', span(0, 6), span(0, 6)));
  assert.equal(root?.container, false);
  assert.equal(root?.name, 'svg');
});

test('treats an empty id as no id instead of emitting a trailing hash', () => {
  const [root] = model.build(
    node('svg', span(0, 20), span(0, 10), [node('rect', span(10, 20), span(10, 20), [], '')]),
  );
  assert.equal(root?.children[0]!.name, 'rect');
});
