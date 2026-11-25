import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DomainError,
  EditorSession,
  FakeFileStore,
  SvgDocument,
  type Shape,
  type ShapeProvider,
  type ShapeProviderRegistry,
  type ShapeRestoreService,
  type SvgElementView,
} from '@svgframe/core';
import { XmlSvgCodec } from '../index.js';
import {
  AlternateGroupProvider,
  createProviderRegistry,
  DuplicateBoxProvider,
  FakeBoxShape,
  numericAttribute,
} from './StrictFixtures.js';

const codec = (options: { readonly withBox?: boolean } = {}): XmlSvgCodec =>
  new XmlSvgCodec(createProviderRegistry(options));

test('decodes the six Phase 1 types and encodes them byte-identically', () => {
  const source =
    '<svg width="400" height="300">' +
    '<rect id="r" x="1.25" y="-2" width="30" height="40" fill="#abc"/>' +
    '<circle id="c" cx="2" cy="3" r="4" fill="red"/>' +
    '<ellipse id="e" cx="4" cy="5" rx="6" ry="7"/>' +
    '<line id="l" x1="0" y1="1" x2="2" y2="3" stroke="black"/>' +
    '<text id="t" x="20" y="30" fill="blue">A &lt; B &amp; C</text>' +
    '</svg>';
  const decoded = codec().decode(source);
  assert.deepEqual(
    decoded.document.all().map((shape) => shape.id),
    ['r', 'c', 'e', 'l', 't'],
  );
  assert.equal(decoded.document.require('r').attributes().fill, '#abc');
  assert.equal(decoded.document.require('t').textContent(), 'A < B & C');
  const expected =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">\n' +
    '  <rect id="r" x="1.25" y="-2" width="30" height="40" fill="#abc"/>\n' +
    '  <circle id="c" cx="2" cy="3" r="4" fill="red"/>\n' +
    '  <ellipse id="e" cx="4" cy="5" rx="6" ry="7"/>\n' +
    '  <line id="l" x1="0" y1="1" x2="2" y2="3" stroke="black"/>\n' +
    '  <text id="t" x="20" y="30" fill="blue">A &lt; B &amp; C</text>\n' +
    '</svg>\n';
  assert.equal(codec().encode(decoded.document), expected);
  assert.equal(codec().encode(codec().decode(expected).document), expected);
});

test('assigns missing ids with the Phase 1 counters and warning order', () => {
  const decoded = codec().decode(
    '<svg width="10px" height="20px"><rect/><g><rect id="rect1"/><rect/></g><g id="g1"/></svg>',
  );
  assert.equal(decoded.document.width, 10);
  assert.equal(decoded.document.height, 20);
  assert.deepEqual(
    decoded.document.all().map((shape) => shape.id),
    ['rect2', 'g2', 'rect1', 'rect3', 'g1'],
  );
  assert.deepEqual(decoded.warnings, [
    'warning: assigned id rect2 to unnamed <rect>',
    'warning: assigned id g2 to unnamed <g>',
    'warning: assigned id rect3 to unnamed <rect>',
  ]);
});

test('applies each leaf world transform exactly once in nested groups', () => {
  const decoded = codec().decode(
    '<svg><g id="g" transform="scale(2) translate(10,20)">' +
      '<rect id="r" x="1" y="2" width="3" height="4" stroke-width="2px"/>' +
      '<circle id="c" cx="1" cy="2" r="3"/>' +
      '<ellipse id="e" cx="1" cy="2" rx="3" ry="4"/>' +
      '<line id="l" x1="1" y1="2" x2="3" y2="4"/>' +
      '<text id="t" x="1" y="2" font-size="10px">A</text>' +
      '</g></svg>',
  );
  const rect = decoded.document.require('r');
  assert.deepEqual(rect.geometry(), { x: '22', y: '44', width: '6', height: '8' });
  assert.equal(rect.attributes()['stroke-width'], '4');
  assert.equal(decoded.document.require('c').geometry().r, '6');
  assert.equal(decoded.document.require('e').geometry().ry, '8');
  assert.equal(decoded.document.require('l').geometry().x2, '26');
  assert.equal(decoded.document.require('t').attributes()['font-size'], '20');
});

test('normalizes translate/scale composition in source order', () => {
  const translated = codec().decode(
    '<svg><g transform="translate(10 20) scale(2)"><rect id="r" x="1" y="2" width="3" height="4"/></g></svg>',
  );
  assert.deepEqual(translated.document.require('r').geometry(), {
    x: '12',
    y: '24',
    width: '6',
    height: '8',
  });
  const scaled = codec().decode(
    '<svg><g transform="scale(2) translate(10,20)"><rect id="r" x="1" y="2" width="3" height="4"/></g></svg>',
  );
  assert.deepEqual(scaled.document.require('r').geometry(), {
    x: '22',
    y: '44',
    width: '6',
    height: '8',
  });
});

test('keeps Phase 1 inheritance and resolves a cancelling inner scale', () => {
  const decoded = codec().decode(
    '<svg><g id="outer" transform="scale(2)" stroke="black" stroke-width="3" font-size="20">' +
      '<g id="inner" transform="scale(.5)"><text id="t" x="2" y="4">A</text></g>' +
      '<circle id="c" cx="10" cy="20" r="3"/>' +
      '</g></svg>',
  );
  const outer = decoded.document.require('outer');
  const inner = decoded.document.require('inner');
  assert.equal(outer.attributes()['stroke-width'], '6');
  assert.equal(inner.attributes()['stroke-width'], '3');
  assert.equal(inner.attributes()['font-size'], '20');
  assert.equal(decoded.document.require('c').attributes()['stroke-width'], undefined);
  assert.equal(decoded.document.require('t').attributes()['font-size'], undefined);
});

test('materializes default text and stroke sizes when a scale has no explicit styles', () => {
  const decoded = codec().decode(
    '<svg><g id="g" transform="scale(2)"><text id="t">A</text></g></svg>',
  );
  assert.equal(decoded.document.require('g').attributes()['font-size'], '32');
  assert.equal(decoded.document.require('g').attributes()['stroke-width'], '2');
  assert.equal(decoded.document.require('t').attributes()['font-size'], undefined);
});

test('rejects length-sensitive attributes under a scale like Phase 1', () => {
  assert.throws(
    () =>
      codec().decode(
        '<svg><g id="g" stroke-dasharray="2 3"><line id="l" transform="scale(2)"/></g></svg>',
      ),
    /unsupported scaled SVG attribute/,
  );
  assert.throws(
    () => codec().decode('<svg><rect id="r" rx="3" transform="scale(2)"/></svg>'),
    /unsupported scaled SVG attribute/,
  );
  assert.throws(
    () => codec().decode('<svg><text id="t" transform="scale(2)" font-size="2em">A</text></svg>'),
    /invalid number/,
  );
});

test('restores a composite fake-box subtree and keeps its type through clone', () => {
  const source =
    '<svg><g id="b" data-kind="fake-box"><rect id="b-rect" x="1" y="2" width="3" height="4"/>' +
    '<text id="b-label" x="5" y="6">label</text></g></svg>';
  const decoded = codec().decode(source);
  const box = decoded.document.require('b');
  assert.ok(box instanceof FakeBoxShape);
  assert.equal(box.kind, 'fake-box');
  assert.deepEqual(
    box.children().map((child) => child.id),
    ['b-rect', 'b-label'],
  );
  const cloned = decoded.document.clone();
  assert.ok(cloned.require('b') instanceof FakeBoxShape);
  assert.equal(cloned.require('b').kind, 'fake-box');
  assert.equal(codec().encode(decoded.document), codec().encode(cloned));
  const encoded = codec().encode(decoded.document);
  assert.equal(codec().encode(codec().decode(encoded).document), encoded);
});

test('keeps the marker and degrades a box without an installed provider', () => {
  const source = '<svg><g id="b" data-kind="fake-box"><rect id="r" x="1" y="2"/></g></svg>';
  const decoded = codec({ withBox: false }).decode(source);
  assert.equal(decoded.document.require('b').tag, 'g');
  assert.equal(decoded.document.require('b').kind, 'g');
  assert.equal(decoded.document.require('b').attributes()['data-kind'], 'fake-box');
  assert.match(codec({ withBox: false }).encode(decoded.document), /data-kind="fake-box"/);
});

test('applies the group transform to children once even for a composite provider', () => {
  const decoded = codec().decode(
    '<svg><g id="b" data-kind="fake-box" transform="translate(5,5)">' +
      '<rect id="r" x="1" y="2" width="3" height="4"/></g></svg>',
  );
  assert.deepEqual(decoded.document.require('r').geometry(), {
    x: '6',
    y: '7',
    width: '3',
    height: '4',
  });
});

test('decodes entity references in ids like the Phase 1 DOM importer', () => {
  const decoded = codec().decode(
    '<svg><rect id="a&amp;b" x="1" y="2" width="3" height="4"/></svg>',
  );
  assert.equal(decoded.document.require('a&b').id, 'a&b');
  const encoded = codec().encode(decoded.document);
  assert.match(encoded, /id="a&amp;b"/);
  assert.equal(codec().decode(encoded).document.require('a&b').id, 'a&b');
});

test('keeps an unknown data-kind on the default tag provider', () => {
  const decoded = codec().decode('<svg><g id="g" data-kind="mystery"><rect id="r"/></g></svg>');
  assert.equal(decoded.document.require('g').tag, 'g');
  assert.equal(decoded.document.require('g').attributes()['data-kind'], 'mystery');
  assert.match(codec().encode(decoded.document), /data-kind="mystery"/);
});

test('rejects ambiguous tag-default providers', () => {
  const registry = createProviderRegistry();
  registry.register(new AlternateGroupProvider());
  assert.throws(
    () => new XmlSvgCodec(registry).decode('<svg><g id="g"/></svg>'),
    /ambiguous provider match for <g>: g, g-alternate/,
  );
});

test('preserves text typography, CDATA text and custom metadata', () => {
  const source =
    '<svg width="100" height="100"><g id="n" data-kind="box">' +
    '<text id="t" x="5" y="6" text-anchor="middle" font-size="16"><![CDATA[A < B & C]]></text>' +
    '</g></svg>';
  const decoded = codec({ withBox: false }).decode(source);
  assert.equal(decoded.document.require('t').textContent(), 'A < B & C');
  assert.equal(decoded.document.require('t').attributes()['font-size'], '16');
  assert.equal(decoded.document.require('t').attributes()['text-anchor'], 'middle');
  assert.equal(decoded.document.require('n').attributes()['data-kind'], 'box');
  const encoded = codec({ withBox: false }).encode(decoded.document);
  assert.match(encoded, /font-size="16"/);
  assert.match(encoded, /text-anchor="middle"/);
  assert.equal(
    codec({ withBox: false }).encode(codec({ withBox: false }).decode(encoded).document),
    encoded,
  );
});

test('rejects duplicate ids before any provider selection or degradation', () => {
  assert.throws(
    () =>
      codec({ withBox: false }).decode(
        '<svg><g data-kind="fake-box"><rect id="x"/><circle id="x"/></g></svg>',
      ),
    /id already exists: x/,
  );
});

test('rejects unknown tags and ambiguous explicit providers', () => {
  assert.throws(
    () => codec().decode('<svg><path id="p" d="M0 0"/></svg>'),
    /unknown shape type: path \(is the plugin loaded\?\)/,
  );
  const registry = createProviderRegistry();
  registry.register(new DuplicateBoxProvider());
  assert.throws(
    () => new XmlSvgCodec(registry).decode('<svg><g id="b" data-kind="fake-box"/></svg>'),
    /ambiguous provider match for <g>: fake-box, fake-box-duplicate/,
  );
});

test('rejects Phase 1 unsupported documents with the expected wording', () => {
  const cases: readonly [string, string, RegExp][] = [
    ['wrong root', '<html/>', /invalid SVG: root must be <svg>/],
    ['wrong namespace', '<svg xmlns="urn:wrong"/>', /invalid SVG namespace/],
    ['nested namespace', '<svg><rect xmlns="urn:wrong"/></svg>', /unsupported SVG namespace/],
    ['prefixed tag', '<svg><x:rect xmlns:x="urn:x"/></svg>', /unsupported SVG namespace/],
    [
      'prefixed attributes',
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><rect id="r" xlink:href="#x"/></svg>',
      /unsupported SVG attribute namespace: xlink/,
    ],
    ['malformed', '<svg><rect></svg>', /invalid SVG XML/],
    ['duplicate ids', '<svg><rect id="r"/><circle id="r"/></svg>', /id already exists: r/],
    ['style', '<svg><rect id="r" style="fill:red"/></svg>', /unsupported SVG attribute: style/],
    ['events', '<svg><rect id="r" onclick="run()"/></svg>', /unsupported SVG attribute: onclick/],
    ['root styles', '<svg fill="red"/>', /unsupported SVG root attribute: fill/],
    ['root id', '<svg id="canvas"/>', /unsupported SVG root attribute: id/],
    [
      'child elements in text',
      '<svg><text id="t"><tspan>a</tspan></text></svg>',
      /unsupported child elements in <text>/,
    ],
    ['root text', '<svg>hello</svg>', /unsupported text outside <text>/],
    ['group text', '<svg><g>hello</g></svg>', /unsupported text outside <text>/],
    [
      'viewBox',
      '<svg width="100" height="100" viewBox="10 10 100 100"/>',
      /unsupported SVG viewBox: expected 0 0 width height/,
    ],
    ['percent width', '<svg width="100%" height="100"/>', /invalid number for width/],
    ['DTD', '<!DOCTYPE svg [<!ENTITY x "hello">]><svg/>', /unsupported SVG: DTD and entities/],
    [
      'xml-stylesheet',
      '<?xml-stylesheet href="external.css" type="text/css"?><svg/>',
      /unsupported SVG: xml-stylesheet/,
    ],
    [
      'nested xml-stylesheet',
      '<svg><g id="g"><?xml-stylesheet href="external.css"?></g></svg>',
      /unsupported SVG: xml-stylesheet/,
    ],
    ['nesting limit', `<svg>${'<g>'.repeat(129)}${'</g>'.repeat(129)}</svg>`, /128 levels/],
  ];
  for (const [name, source, expected] of cases) {
    assert.throws(() => codec().decode(source), expected, name);
  }
});

test('a failing provider aborts the read and leaves the session document untouched', async () => {
  class FailingBoxProvider implements ShapeProvider {
    readonly type = 'fake-box';
    matches(element: SvgElementView): boolean {
      return element.attributes['data-kind'] === 'fake-box';
    }
    create(): Shape {
      throw new Error('not used');
    }
    restore(_element: SvgElementView, _shapes: ShapeRestoreService): Shape {
      throw new DomainError('incomplete fake-box');
    }
  }
  const registry: ShapeProviderRegistry = createProviderRegistry({ withBox: false });
  registry.register(new FailingBoxProvider());
  const failing = new XmlSvgCodec(registry);
  const store = new FakeFileStore();
  store.files.set('bad.svg', '<svg><g id="b" data-kind="fake-box"/></svg>');
  const session = new EditorSession(store, failing);
  session.init();
  const before = session.document();
  await assert.rejects(session.read('bad.svg'), /incomplete fake-box/);
  assert.equal(session.document(), before);
});

test('normalizes CRLF text and attribute values before encoding', () => {
  const decoded = codec().decode('<svg><text id="t" x="1" y="2">A\r\nB</text></svg>');
  assert.equal(decoded.document.require('t').textContent(), 'A\nB');
  assert.doesNotMatch(codec().encode(decoded.document), /\r/);
});

test('exposes numeric geometry through the public projection', () => {
  const document: SvgDocument = codec().decode(
    '<svg><rect id="r" x="1.5" y="2" width="3" height="4"/></svg>',
  ).document;
  assert.equal(numericAttribute(document.require('r'), 'width'), 3);
});
