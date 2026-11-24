import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  FakeEditorSession,
  FakePluginContext,
  FakeShapeCreationService,
  FakeShapeRestoreService,
  QueryContext,
  SvgDocument,
} from '../index.js';
import type { SvgElementView } from '../index.js';
import { DemoBoxProvider } from './support/DemoBoxProvider.js';
import { DemoBoxShape } from './support/DemoBoxShape.js';
import { DemoPlugin } from './support/DemoPlugin.js';
import { SampleCommandDispatcher } from './support/SampleCommandDispatcher.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';

const createShapes = (): FakeShapeCreationService => {
  const service = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  service.register('demo-box', (request) => new DemoBoxProvider().create(request, service));
  return service;
};

const activate = () => {
  const creation = createShapes();
  const context = new FakePluginContext({}, creation);
  const plugin = new DemoPlugin();
  plugin.activate(context);
  return { creation, context, plugin };
};

test('a plugin activates only through the staged public context', () => {
  const { context, plugin } = activate();
  const contributes = plugin.manifest.contributes;
  assert.ok(contributes);
  assert.deepEqual(
    [...context.shapeProviders.names()].sort(),
    [...(contributes.shapes ?? [])].sort(),
  );
  assert.deepEqual([...context.commands.names()].sort(), [...(contributes.commands ?? [])].sort());
  assert.deepEqual(
    [...context.treeDecorators.names()].sort(),
    [...(contributes.decorators ?? [])].sort(),
  );
  assert.deepEqual(
    [...context.attributeHandlers.names()].sort(),
    [...(contributes.attributeHandlers ?? [])].sort(),
  );
  assert.deepEqual(context.commands.names(), ['demo-create', 'demo-stats']);
});

test('the demo provider builds its parts through ShapeCreationService', () => {
  const { creation } = activate();
  const document = new SvgDocument();
  document.add(
    new DemoBoxProvider().create({ type: 'demo-box', id: 'box1', parameters: ['hello'] }, creation),
  );
  assert.equal(document.require('box1').kind, 'demo-box');
  assert.equal(document.require('box1').tag, 'g');
  assert.deepEqual(
    document
      .require('box1')
      .children()
      .map((shape) => shape.id),
    ['box1-rect', 'box1-label'],
  );
  assert.equal(document.require('box1-rect').parent?.id, 'box1');
  assert.deepEqual(
    creation.requests.map((request) => request.type),
    ['rect', 'text'],
  );
});

test('the fake creation service reports a missing provider', () => {
  const creation = new FakeShapeCreationService();
  assert.throws(
    () => creation.create({ type: 'demo-box', id: 'box1', parameters: [] }),
    /unknown shape type: demo-box \(is the plugin loaded\?\)/,
  );
});

test('provider restore uses the restore service and applies transforms once', () => {
  const identity = { scale: 1, translateX: 0, translateY: 0 };
  const view: SvgElementView = {
    tag: 'g',
    id: 'box1',
    attributes: { 'data-kind': 'demo-box' },
    text: null,
    transform: identity,
    children: [
      {
        tag: 'rect',
        id: 'box1-rect',
        attributes: {},
        text: null,
        transform: { scale: 2, translateX: 10, translateY: 20 },
        children: [],
      },
      {
        tag: 'text',
        id: 'box1-label',
        attributes: {},
        text: 'hello',
        transform: identity,
        children: [],
      },
    ],
  };
  const restore = new FakeShapeRestoreService((element) => {
    const leaf = new FakeLeafShape(element.id ?? 'leaf', element.tag);
    leaf.scale(element.transform.scale);
    leaf.move(element.transform.translateX, element.transform.translateY);
    return leaf;
  });
  const restored = new DemoBoxProvider().restore(view, restore);
  assert.ok(restored instanceof DemoBoxShape);
  assert.equal(restored.kind, 'demo-box');
  assert.deepEqual(
    restored.children().map((shape) => shape.id),
    ['box1-rect', 'box1-label'],
  );
  assert.deepEqual(restored.children()[0]!.geometry(), { x: '10', y: '20' });
  assert.deepEqual(
    restore.restored.map((element) => element.id),
    ['box1-rect', 'box1-label'],
  );
});

test('clone keeps the composite plugin type and copies children', () => {
  const { creation } = activate();
  const document = new SvgDocument();
  document.add(
    new DemoBoxProvider().create({ type: 'demo-box', id: 'box1', parameters: [] }, creation),
  );
  const clone = document.require('box1').clone();
  assert.ok(clone instanceof DemoBoxShape);
  assert.equal(clone.kind, 'demo-box');
  assert.notEqual(clone.children()[0], document.require('box1').children()[0]);
  assert.equal(clone.children()[0]!.parent, clone);
});

test('commands, decorators and handlers consume only the public contracts', async () => {
  const { creation, context } = activate();
  const session = new FakeEditorSession();
  const dispatcher = new SampleCommandDispatcher(context.commands, session);
  session.init();
  assert.equal(await dispatcher.execute('demo-create', ['box1']), 'g#box1 created');
  assert.equal(await dispatcher.execute('demo-stats'), 'demo-boxes 1');

  const document = session.document();
  const box = document.require('box1');
  const boxRow = { document, node: box, parent: box.parent, depth: 1 };
  const leafRow = { document, node: document.require('box1-rect'), parent: box, depth: 2 };
  const decorator = context.treeDecorators.require('demo-star');
  assert.equal(decorator.decorate(boxRow), '(demo)');
  assert.equal(decorator.decorate(leafRow), null);

  const candidate = new SvgDocument();
  candidate.add(
    new DemoBoxProvider().create({ type: 'demo-box', id: 'box2', parameters: [] }, creation),
  );
  const handler = context.attributeHandlers.require('demo-attributes');
  const result = handler.apply(
    { document: candidate },
    { targetId: 'box2', attribute: 'fill', value: 'green' },
  );
  assert.equal(result.message, 'fill=green');
  assert.equal(candidate.require('box2-rect').attributes().fill, 'green');

  const queryContext = new QueryContext(document);
  assert.equal(queryContext.hasDocument, true);
  assert.equal(queryContext.document().require('box1').id, 'box1');
  assert.equal((queryContext as unknown as { edit?: unknown }).edit, undefined);
});

test('consumer examples import only the public package entry', async () => {
  const directory = new URL('./support/', import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith('.js'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(new URL(file, directory), 'utf8');
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1]!;
      assert.ok(
        specifier === '../../index.js' || specifier.startsWith('./'),
        `${file} imports ${specifier}`,
      );
    }
  }
});
