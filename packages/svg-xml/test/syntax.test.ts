import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSvgSyntax } from '../index.js';
import type { SvgSyntaxElement, SvgSyntaxSpan } from '../index.js';

const rootOf = (source: string): SvgSyntaxElement => {
  const result = parseSvgSyntax(source);
  if (!result.ok) assert.fail(result.message);
  return result.root;
};

const slice = (source: string, span: SvgSyntaxSpan): string => source.slice(span.start, span.end);

test('parses a nested root, containers and leaves with exact spans', () => {
  const source =
    '<svg width="800" height="600">\n' +
    '  <g id="flow">\n' +
    '    <rect id="a" x="1" y="2"/>\n' +
    '    <circle id="b" cx="3"/>\n' +
    '  </g>\n' +
    '</svg>';
  const root = rootOf(source);
  assert.equal(root.tag, 'svg');
  assert.equal(root.id, undefined);
  assert.equal(slice(source, root.outerSpan), source);
  assert.equal(slice(source, root.startTagSpan), '<svg width="800" height="600">');
  assert.equal(slice(source, root.nameSpan), 'svg');
  assert.equal(root.children.length, 1);

  const group = root.children[0]!;
  assert.equal(group.tag, 'g');
  assert.equal(group.id, 'flow');
  assert.equal(
    slice(source, group.outerSpan),
    '<g id="flow">\n    <rect id="a" x="1" y="2"/>\n    <circle id="b" cx="3"/>\n  </g>',
  );
  assert.equal(group.children.length, 2);

  const rect = group.children[0]!;
  assert.equal(rect.tag, 'rect');
  assert.equal(rect.id, 'a');
  assert.equal(slice(source, rect.outerSpan), '<rect id="a" x="1" y="2"/>');
  assert.equal(slice(source, rect.startTagSpan), '<rect id="a" x="1" y="2"/>');
  assert.equal(slice(source, rect.nameSpan), 'rect');

  const circle = group.children[1]!;
  assert.equal(circle.id, 'b');
  assert.equal(slice(source, circle.outerSpan), '<circle id="b" cx="3"/>');
});

test('keeps duplicate tags and several elements on the same line distinct', () => {
  const source = '<svg><rect id="a"/><rect id="b"/><rect/></svg>';
  const root = rootOf(source);
  const [first, second, third] = root.children;
  assert.equal(root.children.length, 3);
  assert.equal(first!.id, 'a');
  assert.equal(second!.id, 'b');
  assert.equal(third!.id, undefined);
  assert.equal(slice(source, first!.outerSpan), '<rect id="a"/>');
  assert.equal(slice(source, second!.outerSpan), '<rect id="b"/>');
  assert.equal(slice(source, third!.outerSpan), '<rect/>');
  assert.ok(first!.outerSpan.start < second!.outerSpan.start);
  assert.ok(second!.outerSpan.start < third!.outerSpan.start);
  assert.equal(slice(source, first!.nameSpan), 'rect');
  assert.equal(slice(source, second!.nameSpan), 'rect');
});

test('keeps unknown tags and nested svg elements instead of applying a CLI whitelist', () => {
  const source = '<svg><foreign:thing data-x="1"><svg><rect/></svg></foreign:thing></svg>';
  const root = rootOf(source);
  const foreign = root.children[0]!;
  assert.equal(foreign.tag, 'foreign:thing');
  assert.equal(foreign.children[0]!.tag, 'svg');
  assert.equal(foreign.children[0]!.children[0]!.tag, 'rect');
  assert.equal(
    slice(source, foreign.outerSpan),
    '<foreign:thing data-x="1"><svg><rect/></svg></foreign:thing>',
  );
});

test('keeps duplicate nested tags and resolves spans by position, not by tag text', () => {
  const source = '<svg><g id="one"><g id="two"><g id="three"/></g></g></svg>';
  const root = rootOf(source);
  const one = root.children[0]!;
  const two = one.children[0]!;
  const three = two.children[0]!;
  assert.deepEqual([one.id, two.id, three.id], ['one', 'two', 'three']);
  assert.equal(slice(source, one.outerSpan), '<g id="one"><g id="two"><g id="three"/></g></g>');
  assert.equal(slice(source, two.outerSpan), '<g id="two"><g id="three"/></g>');
  assert.equal(slice(source, three.outerSpan), '<g id="three"/>');
  assert.ok(one.outerSpan.start < two.outerSpan.start);
  assert.ok(two.outerSpan.start < three.outerSpan.start);
});

test('collects direct text only, raw and without decoding', () => {
  const source = '<svg><text id="t">你好😀 &amp;</text><g>before<rect/>after</g></svg>';
  const root = rootOf(source);
  assert.equal(root.text, '');
  assert.equal(root.children[0]!.text, '你好😀 &amp;');
  assert.equal(root.children[1]!.text, 'beforeafter');
  assert.equal(slice(source, root.children[0]!.outerSpan), '<text id="t">你好😀 &amp;</text>');
});

test('treats CJK and emoji offsets as UTF-16 code units', () => {
  const source = '<!-- 中文😀 -->\n<svg><text id="标题">内容 😀</text></svg>';
  const root = rootOf(source);
  assert.equal(
    source.slice(root.outerSpan.start, root.outerSpan.end),
    '<svg><text id="标题">内容 😀</text></svg>',
  );
  assert.equal(source.slice(root.nameSpan.start, root.nameSpan.end), 'svg');
  const text = root.children[0]!;
  assert.equal(text.id, '标题');
  assert.equal(text.text, '内容 😀');
  assert.equal(text.outerSpan.end - text.outerSpan.start, '<text id="标题">内容 😀</text>'.length);
});

test('handles CRLF line endings and leading whitespace', () => {
  const source = '\r\n  <svg>\r\n  <rect id="a"/>\r\n</svg>\r\n';
  const root = rootOf(source);
  assert.equal(
    source.slice(root.outerSpan.start, root.outerSpan.end),
    '<svg>\r\n  <rect id="a"/>\r\n</svg>',
  );
  assert.equal(root.children[0]!.id, 'a');
  assert.equal(
    source.slice(root.children[0]!.outerSpan.start, root.children[0]!.outerSpan.end),
    '<rect id="a"/>',
  );
  assert.ok(root.text.includes('\r\n'));
});

test('skips xml declaration, doctype with internal subset, comments and instructions before the root', () => {
  const source =
    '<?xml version="1.0"?>\n' +
    '<!DOCTYPE svg [ <!ENTITY x "y"> ]>\n' +
    '<!-- lead -->\n' +
    '<svg><!-- inner --><rect/></svg>';
  const root = rootOf(source);
  assert.equal(root.tag, 'svg');
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0]!.tag, 'rect');
  assert.equal(root.text, '');
  assert.equal(root.outerSpan.start, source.indexOf('<svg>'));
});

test('allows a self-closing root and CDATA text', () => {
  assert.equal(rootOf('<svg/>').tag, 'svg');
  const source = '<svg><text><![CDATA[a<b&c]]></text></svg>';
  const root = rootOf(source);
  assert.equal(root.children[0]!.text, 'a<b&c');
  assert.equal(slice(source, root.children[0]!.outerSpan), '<text><![CDATA[a<b&c]]></text>');
});

test('reads attribute values containing > and quotes', () => {
  const source = '<svg><rect id="a>b" data-x=\'q"q\'/></svg>';
  const root = rootOf(source);
  const rect = root.children[0]!;
  assert.equal(rect.id, 'a>b');
  assert.equal(slice(source, rect.outerSpan), '<rect id="a>b" data-x=\'q"q\'/>');
});

test('allows trailing whitespace and comments after the root', () => {
  assert.equal(rootOf('<svg/>\r\n<!-- tail -->').tag, 'svg');
});

test('accepts a BOM, multiline start tags, spaced slashes and whitespace before >', () => {
  const source =
    '\uFEFF<svg\n  width="10"\n  height="20">\n  <rect id="a" />\n  <g id="b"></g >\n</svg>';
  const root = rootOf(source);
  assert.equal(root.tag, 'svg');
  assert.equal(slice(source, root.startTagSpan), '<svg\n  width="10"\n  height="20">');
  assert.equal(root.children[0]!.id, 'a');
  assert.equal(slice(source, root.children[0]!.outerSpan), '<rect id="a" />');
  assert.equal(root.children[1]!.id, 'b');
  assert.equal(slice(source, root.children[1]!.outerSpan), '<g id="b"></g >');
});

test('keeps raw id values with entities and dotted or dashed tag names', () => {
  const source = '<svg><my-shape.two id="a&amp;b"/></svg>';
  const root = rootOf(source);
  assert.equal(root.children[0]!.tag, 'my-shape.two');
  assert.equal(root.children[0]!.id, 'a&amp;b');
});

test('ignores processing instructions and comments inside an element', () => {
  const source = '<svg><?inside test?><g id="a"><!-- note --><rect/></g></svg>';
  const root = rootOf(source);
  assert.equal(root.children[0]!.tag, 'g');
  assert.equal(root.children[0]!.children.length, 1);
  assert.equal(slice(source, root.children[0]!.outerSpan), '<g id="a"><!-- note --><rect/></g>');
});

test('reports malformed and incomplete XML without throwing', () => {
  const inputs = [
    '',
    '   ',
    'not xml',
    '<',
    '<svg',
    '<svg>',
    '<svg><g>',
    '<svg><g></svg>',
    '<svg></g>',
    '<svg><rect id="a"></g></svg>',
    '<svg><rect id=></svg>',
    '<svg><rect id="x></svg>',
    '<svg><!--',
    '<svg><![CDATA[x',
    '<svg></svg><svg/>',
    '<svg><!FOO></svg>',
    '<svg><rect/></svg>junk',
    '<svg/><!DOCTYPE svg>',
  ];
  for (const source of inputs) {
    assert.doesNotThrow(() => parseSvgSyntax(source), source);
    const result = parseSvgSyntax(source);
    assert.equal(result.ok, false, source);
    assert.ok(!result.ok && result.message.length > 0, source);
  }
});

test('reports a controlled failure when trailing content follows the root element', () => {
  const result = parseSvgSyntax('<svg/><!DOCTYPE svg>text');
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.message.includes('unexpected content'));
});
