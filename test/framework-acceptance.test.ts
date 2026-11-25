import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttributeEditAction,
  AttributeEditingService,
  AttributeHandlerRegistry,
  CreateAction,
  DeleteAction,
  EditorSession,
  FakeFileStore,
  FaultyTreeDecorator,
  ProviderShapeCreationService,
  ShapeProviderRegistry,
  StructureService,
  TreeDecoratorRegistry,
  TreePresenter,
  SvgDocument,
} from '@svgframe/core';
import { XmlSvgCodec } from '@svgframe/svg-xml';
import { FailingStampHandler } from './framework/FailingStampHandler.js';
import { StampAttributes } from './framework/StampAttributes.js';
import { StampBadgeDecorator } from './framework/StampBadgeDecorator.js';
import { StampPartProvider } from './framework/StampPartProvider.js';
import { StampProvider } from './framework/StampProvider.js';
import { StampShape } from './framework/StampShape.js';

/**
 * Framework acceptance (TASK-FRAME-01): one test-only composite type proves the
 * four extension points without any business name (`box`, `stats`, `dir`, ...).
 *
 * Only `stamp`, `stamp-frame` and `stamp-label` are registered here; builtins and
 * plugins are never imported, so the generic path is what is being verified.
 */
function setup() {
  const providers = new ShapeProviderRegistry();
  providers.register(new StampProvider());
  providers.register(new StampPartProvider('stamp-frame', 'rect', 'stamp-frame <id>'));
  providers.register(new StampPartProvider('stamp-label', 'text', 'stamp-label <id> [caption]'));
  const creation = new ProviderShapeCreationService(providers);
  const codec = new XmlSvgCodec(providers);
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new StampAttributes());
  handlers.register(new FailingStampHandler());
  const attributes = new AttributeEditingService(handlers);
  const session = new EditorSession(new FakeFileStore(), codec);
  session.init(400, 300);
  return { providers, creation, codec, handlers, attributes, session };
}

function documentOf(session: EditorSession): SvgDocument {
  return session.document() as SvgDocument;
}

function addStamp(
  session: EditorSession,
  creation: ProviderShapeCreationService,
  id: string,
  caption = 'draft',
): void {
  session.edit(new CreateAction(creation, 'stamp', id, [caption]));
}

test('create: a composite provider builds role parts through the public creation service', () => {
  const { session, creation } = setup();
  const message = session.edit(new CreateAction(creation, 'stamp', 's1', ['draft']));
  assert.equal(message, 'g#s1 created');
  const stamp = session.document().require('s1');
  assert.ok(stamp instanceof StampShape);
  assert.equal(stamp.kind, 'stamp');
  assert.equal(stamp.tag, 'g');
  assert.deepEqual(
    stamp.children().map((child) => child.id),
    ['s1-frame', 's1-label'],
  );
  assert.equal(stamp.children()[0]!.tag, 'rect');
  assert.equal(stamp.children()[1]!.tag, 'text');
  assert.equal(stamp.children()[1]!.textContent(), 'draft');
  assert.equal(stamp.attributes()['data-kind'], 'stamp');
  documentOf(session).validate();
});

test('clone and undo/redo keep the plugin type, parts and parent links', () => {
  const { session, creation, codec } = setup();
  addStamp(session, creation, 's1', 'draft');
  const stamp = documentOf(session).require('s1') as StampShape;
  const copy = stamp.clone();
  assert.ok(copy instanceof StampShape);
  assert.equal(copy.kind, 'stamp');
  assert.notEqual(copy.children()[0], stamp.children()[0]);
  assert.equal(copy.children()[0]!.parent, copy);
  const documentCopy = documentOf(session).clone();
  assert.ok(documentCopy.require('s1') instanceof StampShape);
  assert.equal(codec.encode(documentCopy), codec.encode(session.document()));
  session.undo();
  assert.equal(documentOf(session).all().length, 0);
  session.redo();
  assert.ok(documentOf(session).require('s1') instanceof StampShape);
  assert.equal(documentOf(session).require('s1-label').textContent(), 'draft');
});

test('invariant and structural policy protect necessary parts without kernel branches', () => {
  const { session, creation } = setup();
  addStamp(session, creation, 's1', 'draft');
  const stamp = documentOf(session).require('s1') as StampShape;
  const label = documentOf(session).require('s1-label');
  assert.equal(stamp.canRemoveChild(label), false);
  assert.equal(stamp.canUngroup(), false);
  assert.throws(
    () => session.edit(new DeleteAction(new StructureService(), 's1-label')),
    /cannot remove necessary part: s1-label/,
  );
  assert.equal(documentOf(session).all().length, 3);
  stamp.remove(documentOf(session).require('s1-label'));
  assert.throws(() => documentOf(session).validate(), /incomplete stamp: s1 is missing s1-label/);
});

test('provider restore roundtrip keeps the composite type and applies transforms once', () => {
  const { codec } = setup();
  const source = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">',
    '  <g id="s9" data-kind="stamp" transform="translate(10,20)">',
    '    <rect id="s9-frame" x="0" y="0" width="40" height="20" fill="red"/>',
    '    <text id="s9-label" x="4" y="14">hello</text>',
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
  const decoded = codec.decode(source);
  const restored = decoded.document.require('s9');
  assert.ok(restored instanceof StampShape);
  assert.equal(restored.kind, 'stamp');
  assert.deepEqual(
    restored.children().map((child) => child.id),
    ['s9-frame', 's9-label'],
  );
  assert.deepEqual(restored.children()[0]!.geometry(), {
    x: '10',
    y: '20',
    width: '40',
    height: '20',
  });
  assert.equal(decoded.document.require('s9-label').textContent(), 'hello');
  assert.equal(restored.attributes()['data-kind'], 'stamp');
  const encoded = codec.encode(decoded.document);
  const again = codec.decode(encoded).document.require('s9');
  assert.ok(again instanceof StampShape);
  assert.equal(codec.encode(codec.decode(encoded).document), encoded);
});

test('one attribute request edits several parts and stays a single undo unit', () => {
  const { session, creation, attributes, codec } = setup();
  addStamp(session, creation, 's1', 'draft');
  const before = codec.encode(session.document());
  const message = session.edit(
    new AttributeEditAction(attributes, { targetId: 's1', attribute: 'caption', value: 'v2' }),
  );
  assert.equal(message, 'stamp#s1 caption="v2"');
  assert.equal(documentOf(session).require('s1-label').textContent(), 'v2');
  assert.equal(documentOf(session).require('s1-frame').attributes().fill, 'blue');
  assert.notEqual(codec.encode(session.document()), before);
  session.undo();
  assert.equal(codec.encode(session.document()), before);
  assert.equal(documentOf(session).require('s1-label').textContent(), 'draft');
  assert.equal(documentOf(session).require('s1-frame').attributes().fill, undefined);
  session.redo();
  assert.equal(documentOf(session).require('s1-label').textContent(), 'v2');
  session.undo();
  session.undo();
  assert.equal(documentOf(session).all().length, 0);
  assert.throws(() => session.undo(), /nothing to undo/);
});

test('a failing handler keeps document, history and committed events unchanged', () => {
  const { session, creation, attributes, codec } = setup();
  addStamp(session, creation, 's1', 'draft');
  const decorators = new TreeDecoratorRegistry();
  const badge = new StampBadgeDecorator();
  decorators.register(badge);
  const presenter = new TreePresenter(decorators);
  const detach = presenter.connect(session.events);
  const before = codec.encode(session.document());
  const eventsBefore = badge.events.length;
  assert.throws(
    () =>
      session.edit(
        new AttributeEditAction(attributes, { targetId: 's1', attribute: 'boom', value: 'x' }),
      ),
    /stamp handler failed: stamp-failing/,
  );
  assert.equal(codec.encode(session.document()), before);
  assert.equal(documentOf(session).require('s1-label').textContent(), 'draft');
  assert.equal(badge.events.length, eventsBefore);
  session.undo();
  assert.equal(documentOf(session).all().length, 0);
  detach();
});

test('decorator suffix and decorator failure isolation keep the base tree bytes', () => {
  const { session, creation, codec } = setup();
  addStamp(session, creation, 's1', 'draft');
  const plain = new TreePresenter(new TreeDecoratorRegistry()).tree(session.document());
  assert.deepEqual(plain, [
    'svg (400x300)',
    '└── g#s1',
    '    ├── rect#s1-frame  x=0 y=0 w=40 h=20',
    '    └── text#s1-label  (4,14) "draft"',
  ]);
  const reports: string[] = [];
  const decorators = new TreeDecoratorRegistry();
  decorators.register(new StampBadgeDecorator());
  decorators.register(new FaultyTreeDecorator('faulty-decorator', 'decorate'));
  const presenter = new TreePresenter(decorators, (_error, name) => reports.push(name));
  const before = codec.encode(session.document());
  const lines = presenter.tree(session.document());
  assert.equal(lines[0], 'svg (400x300)');
  assert.equal(lines[1], '└── g#s1 (stamp)');
  assert.equal(lines[2], '    ├── rect#s1-frame  x=0 y=0 w=40 h=20');
  assert.equal(lines[3], '    └── text#s1-label  (4,14) "draft"');
  assert.equal(presenter.isDisabled('faulty-decorator'), true);
  assert.deepEqual(reports, ['faulty-decorator']);
  assert.equal(codec.encode(session.document()), before);
  assert.deepEqual(presenter.tree(session.document()), lines);
});

test('a failing decorator event observer is isolated and others still receive events', () => {
  const { session, creation } = setup();
  const decorators = new TreeDecoratorRegistry();
  const badge = new StampBadgeDecorator();
  decorators.register(badge);
  decorators.register(new FaultyTreeDecorator('faulty-event', 'event'));
  const presenter = new TreePresenter(decorators);
  const detach = presenter.connect(session.events);
  addStamp(session, creation, 's1', 'draft');
  assert.equal(presenter.isDisabled('faulty-event'), true);
  assert.deepEqual(badge.events, ['editCommitted']);
  assert.ok(documentOf(session).require('s1') instanceof StampShape);
  detach();
});

test('the four registries reject duplicate names and unknown names', () => {
  const { providers } = setup();
  assert.throws(
    () => providers.register(new StampProvider()),
    /duplicate shape provider registration: stamp/,
  );
  assert.throws(
    () => providers.require('box'),
    /unknown shape type: box \(is the plugin loaded\?\)/,
  );
});
