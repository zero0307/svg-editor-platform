import test from 'node:test';
import assert from 'node:assert/strict';
import type { SvgSyntaxElement } from '@svgframe/svg-xml';
import type { OutlineNode } from '../src/OutlineNode.js';
import type { OutlineParseResult } from '../src/OutlineParseResult.js';
import { SvgSyntaxOutlineMapper } from '../src/SvgSyntaxOutlineMapper.js';

const mapper = new SvgSyntaxOutlineMapper();

const element = (
  tag: string,
  outerSpan: { start: number; end: number },
  startTagSpan: { start: number; end: number },
  children: readonly SvgSyntaxElement[] = [],
  id?: string,
): SvgSyntaxElement => ({
  tag,
  id,
  attributes: id === undefined ? {} : { id },
  text: '',
  children,
  outerSpan,
  startTagSpan,
  nameSpan: { start: startTagSpan.start + 1, end: startTagSpan.start + 1 + tag.length },
});

const slice = (source: string, span: { start: number; end: number }): string =>
  source.slice(span.start, span.end);

const outlineOf = (result: OutlineParseResult): OutlineNode => {
  if (!result.ok) assert.fail(result.message);
  return result.root;
};

test('maps neutral syntax spans verbatim into outline nodes', () => {
  const root = element('svg', { start: 0, end: 40 }, { start: 0, end: 5 }, [
    element(
      'g',
      { start: 5, end: 35 },
      { start: 5, end: 15 },
      [element('rect', { start: 15, end: 25 }, { start: 15, end: 25 }, [], 'a')],
      'flow',
    ),
  ]);
  const node = mapper.toNode(root);
  assert.equal(node.tag, 'svg');
  assert.equal(node.id, undefined);
  assert.deepEqual(node.range, { start: 0, end: 40 });
  assert.deepEqual(node.startTag, { start: 0, end: 5 });
  assert.deepEqual(node.name, { start: 1, end: 4 });
  const group = node.children[0]!;
  assert.equal(group.tag, 'g');
  assert.equal(group.id, 'flow');
  assert.deepEqual(group.range, { start: 5, end: 35 });
  assert.deepEqual(group.name, { start: 6, end: 7 });
  assert.deepEqual(group.children[0]!.range, { start: 15, end: 25 });
  assert.notEqual(node, root);
});

test('parses nested groups, missing ids and duplicate tags from real SVG', () => {
  const source =
    '<svg width="320" height="160">\n' +
    '  <g id="flow">\n' +
    '    <g>\n' +
    '      <circle id="dot" cx="60" cy="60" r="30"/>\n' +
    '      <rect x="120" y="30" width="60" height="60"/>\n' +
    '    </g>\n' +
    '  </g>\n' +
    '  <rect/>\n' +
    '  <rect/>\n' +
    '</svg>';
  const root = outlineOf(mapper.parse(source));
  assert.equal(slice(source, root.range), source);
  assert.equal(slice(source, root.startTag), '<svg width="320" height="160">');
  assert.equal(slice(source, root.name), 'svg');
  assert.deepEqual(
    root.children.map((child) => child.tag),
    ['g', 'rect', 'rect'],
  );
  const group = root.children[0]!;
  assert.equal(group.id, 'flow');
  assert.equal(slice(source, group.startTag), '<g id="flow">');
  assert.ok(slice(source, group.range).endsWith('</g>'));
  const inner = group.children[0]!;
  assert.equal(inner.id, undefined);
  assert.deepEqual(
    inner.children.map((child) => child.tag),
    ['circle', 'rect'],
  );
  assert.equal(
    slice(source, inner.children[0]!.startTag),
    '<circle id="dot" cx="60" cy="60" r="30"/>',
  );
  assert.equal(slice(source, inner.children[0]!.name), 'circle');
  assert.equal(
    slice(source, inner.children[0]!.range),
    '<circle id="dot" cx="60" cy="60" r="30"/>',
  );
});

test('converts CRLF, CJK and emoji offsets as UTF-16 code units', () => {
  const source =
    '<svg>\r\n' +
    '  <g id="图形">\r\n' +
    '    <text>🎨 画布</text>\r\n' +
    '    <rect/>\r\n' +
    '  </g>\r\n' +
    '</svg>';
  const root = outlineOf(mapper.parse(source));
  assert.equal(slice(source, root.range), source);
  assert.equal(source.length, root.range.end);
  const group = root.children[0]!;
  assert.equal(slice(source, group.startTag), '<g id="图形">');
  assert.equal(slice(source, group.name), 'g');
  const [text, rect] = group.children;
  assert.equal(slice(source, text!.range), '<text>🎨 画布</text>');
  assert.equal(slice(source, text!.startTag), '<text>');
  assert.equal(slice(source, rect!.range), '<rect/>');
  // The emoji is two UTF-16 code units, so the next sibling starts after them.
  assert.equal(rect!.range.start, source.indexOf('<rect/>'));
  assert.ok(rect!.range.start < rect!.range.end);
});

test('keeps several elements on the same line distinct', () => {
  const source = '<svg><rect id="a"/><rect id="b"/><rect/></svg>';
  const root = outlineOf(mapper.parse(source));
  const [first, second, third] = root.children;
  assert.equal(slice(source, first!.range), '<rect id="a"/>');
  assert.equal(slice(source, second!.range), '<rect id="b"/>');
  assert.equal(slice(source, third!.range), '<rect/>');
  assert.ok(first!.range.start < second!.range.start);
  assert.ok(second!.range.start < third!.range.start);
  assert.equal(slice(source, third!.name), 'rect');
});

test('reports incomplete XML as a controlled failure instead of throwing', () => {
  for (const source of ['<svg><g>', '<svg><g></svg>', '', 'not xml']) {
    let result: OutlineParseResult | undefined;
    assert.doesNotThrow(() => {
      result = mapper.parse(source);
    });
    assert.equal(result!.ok, false, source);
    if (!result!.ok) assert.ok(result!.message.length > 0);
  }
});
