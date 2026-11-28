import test from 'node:test';
import assert from 'node:assert/strict';
import type { OutlineSymbol } from '../src/OutlineSymbol.js';
import { SvgOutlineReader } from '../src/SvgOutlineReader.js';

const reader = new SvgOutlineReader();

const flatten = (symbols: readonly OutlineSymbol[]): readonly OutlineSymbol[] =>
  symbols.flatMap((symbol) => [symbol, ...flatten(symbol.children)]);

test('returns an empty outline and a warning for incomplete XML', () => {
  const reading = reader.read('<svg><g>');
  assert.deepEqual(reading.symbols, []);
  assert.match(reading.warning ?? '', /^SVG outline unavailable: /);
});

test('refreshes the outline on every read instead of caching', () => {
  const first = reader.read('<svg><rect id="a"/></svg>');
  assert.equal(first.warning, undefined);
  assert.deepEqual(
    first.symbols[0]!.children.map((symbol) => symbol.name),
    ['rect#a'],
  );

  const edited = reader.read('<svg><rect id="a"/><circle id="b"/></svg>');
  assert.deepEqual(
    edited.symbols[0]!.children.map((symbol) => symbol.name),
    ['rect#a', 'circle#b'],
  );

  const broken = reader.read('<svg><rect id="a">');
  assert.deepEqual(broken.symbols, []);
  assert.ok(broken.warning !== undefined);

  const repaired = reader.read('<svg><rect id="a"/></svg>');
  assert.equal(repaired.warning, undefined);
  assert.deepEqual(
    repaired.symbols[0]!.children.map((symbol) => symbol.name),
    ['rect#a'],
  );
});

test('labels root, containers and leaves with ids and without ids', () => {
  const root = reader.read('<svg><g id="flow"><rect/><g><circle id="dot"/></g></g></svg>')
    .symbols[0]!;
  assert.equal(root.name, 'svg');
  assert.equal(root.container, true);
  const flow = root.children[0]!;
  assert.equal(flow.name, 'g#flow');
  assert.equal(flow.container, true);
  assert.deepEqual(
    flow.children.map((symbol) => symbol.name),
    ['rect', 'g'],
  );
  assert.equal(flow.children[1]!.container, true);
  assert.equal(flow.children[1]!.children[0]!.name, 'circle#dot');
  assert.equal(flow.children[1]!.children[0]!.container, false);
});

test('keeps the selection range inside the element range for every symbol', () => {
  const reading = reader.read('<svg>\n  <g id="a">\n    <rect/>\n  </g>\n  <text>x</text>\n</svg>');
  const symbols = flatten(reading.symbols);
  assert.equal(symbols.length, 4);
  for (const symbol of symbols) {
    assert.ok(symbol.selectionRange.start >= symbol.range.start, symbol.name);
    assert.ok(symbol.selectionRange.end <= symbol.range.end, symbol.name);
    assert.ok(symbol.selectionRange.start < symbol.selectionRange.end, symbol.name);
  }
});
