import assert from 'node:assert/strict';
import test from 'node:test';
import type { EditorSessionPort, EditableDocument, DocumentView } from '@svgframe/core';
import { FakeEditorSession, TestPluginContext, FaultAfterWrite } from '@svgframe/core/testing';
import { ProbePlugin } from './ProbePlugin.js';
import { ProbeShape } from './ProbeShape.js';

test('four extension points can be consumed using only the public API', async () => {
  const ctx = new TestPluginContext();
  for (const category of [ctx.commands, ctx.shapes, ctx.decorators, ctx.attributes])
    assert.equal(category.size, 0);
  const plugin = new ProbePlugin();
  plugin.activate(ctx);
  assert.throws(() => ctx.registerCommand(plugin), /duplicate registration: commands\/probe/);
  const command = ctx.commands.get('probe')!;
  assert.equal(command.requiresDocument, false);
  const prepared = command.prepare([]);
  assert.equal(prepared.effect, 'query');
  assert.equal(
    await prepared.run({ directory: { cwd: () => '/fixture', list: async () => [] }, help: [] }),
    '/fixture',
  );

  const shapes = { create: plugin.create.bind(plugin) };
  const provider = ctx.shapes.get('probe')!;
  const shape = provider.create({ type: 'probe', id: 'p', args: [] }, shapes);
  const element = {
    tag: 'rect',
    id: 'p',
    attributes: { 'data-kind': 'probe', fill: 'green' },
    text: '',
    children: [],
  };
  assert.equal(provider.matches(element), 'kind');
  assert.equal(provider.restore(element, [], shapes).snapshot().attributes.fill, 'green');
  const handler = ctx.attributes.get('probe')!;
  const original = shape.snapshot();
  assert.equal(handler.handles(original, 'paint'), true);
  assert.equal(handler.handles(original, 'other'), false);
  const copy = shape.clone();
  const root = { children: [copy], insert() {}, remove() {}, canUngroup: () => false };
  const candidate: EditableDocument = {
    root,
    shapes,
    parentOf: () => root,
    require: () => copy,
    add() {},
  };
  assert.equal(handler.apply(candidate, 'p', 'paint', 'red'), 'red');
  assert.equal(copy.snapshot().attributes.fill, 'red');
  assert.throws(
    () => new FaultAfterWrite().apply(candidate, 'p', 'probe-fill', 'blue'),
    /after candidate write/,
  );
  assert.equal(copy.snapshot().attributes.fill, 'blue');
  assert.deepEqual(shape.snapshot(), original);
  const decorator = ctx.decorators.get('probe')!;
  assert.equal(decorator.suffix({ kind: 'shape', shape: original }), '(probe)');
  assert.equal(
    decorator.suffix({ kind: 'canvas', document: { width: 1, height: 1, children: [] } }),
    undefined,
  );
});

test('structured session consumer creates, saves and reads independently of CLI or host', async () => {
  const files = new Map<string, DocumentView>();
  const makeSession = (): EditorSessionPort =>
    new FakeEditorSession((req) => new ProbeShape(req.id).snapshot(), files);
  const writer = makeSession();
  writer.init(80, 60);
  writer.create({ type: 'probe', id: 'p', args: [] });
  assert.equal((await writer.save('demo.svg')).path, 'demo.svg');
  const reader = makeSession();
  assert.throws(() => reader.snapshot(), /no document/);
  const result = await reader.read('demo.svg');
  assert.deepEqual(result.warnings, []);
  assert.equal(result.document.children[0]?.id, 'p');
  assert.equal(result.document.width, 80);
  await assert.rejects(reader.read('missing.svg'), /cannot read/);
  reader.init(10, 20);
  assert.equal(writer.snapshot().children.length, 1);
  assert.equal(reader.snapshot().children.length, 0);
});
