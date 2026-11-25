import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FakePluginContext, SvgDocument, TreePresenter } from '@svgframe/core';
import plugin, {
  ModifiedStarDecorator,
  ModifiedStarPlugin,
  modifiedStarManifest,
} from '../index.js';
import { initialized, saved, scene } from './Scenes.js';
import type { TreeDecorator } from '@svgframe/core';

interface PackageManifest {
  name: string;
  version: string;
  svgframe?: { contributes?: { decorators?: readonly string[] } };
}

async function packageManifest(): Promise<PackageManifest> {
  const source = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
  return JSON.parse(source) as PackageManifest;
}

test('activate registers only the decorator through the staged context', () => {
  const context = new FakePluginContext();
  plugin.activate(context);
  assert.deepEqual(context.treeDecorators.names(), ['modified-star']);
  assert.deepEqual(context.commands.names(), []);
  assert.deepEqual(context.shapeProviders.names(), []);
  assert.deepEqual(context.attributeHandlers.names(), []);
  const decorator = context.treeDecorators.require('modified-star');
  assert.ok(decorator instanceof ModifiedStarDecorator);
  assert.equal(decorator.name, 'modified-star');
  assert.equal(typeof context.subscribe(() => {}), 'function');
});

test('the staged subscription feeds lifecycle events to the registered instance', () => {
  const context = new FakePluginContext();
  plugin.activate(context);
  const decorator = context.treeDecorators.require('modified-star') as TreeDecorator;
  const empty = new SvgDocument(800, 600);
  context.publish(initialized(empty));
  const current = scene();
  const presenter = new TreePresenter(context.treeDecorators);
  assert.deepEqual(presenter.tree(current), [
    'svg (800x600) *',
    '├── g#g1 *',
    '│   ├── rect#r1 *',
    '│   └── rect#r2 *',
    '└── g#g2 *',
    '    └── text#t1 *',
  ]);
  context.publish(saved(current));
  assert.deepEqual(presenter.tree(current), [
    'svg (800x600)',
    '├── g#g1',
    '│   ├── rect#r1',
    '│   └── rect#r2',
    '└── g#g2',
    '    └── text#t1',
  ]);
  assert.equal(
    decorator.decorate({ document: current, node: current.root, parent: null, depth: 0 }),
    null,
  );
});

test('default export is the plugin module with the shared manifest', () => {
  assert.ok(plugin instanceof ModifiedStarPlugin);
  assert.equal(plugin.manifest, modifiedStarManifest);
  assert.equal(plugin.manifest.name, '@svgframe/tree-modified');
  assert.equal(plugin.manifest.version, '0.0.0');
  assert.deepEqual(plugin.manifest.contributes?.decorators, ['modified-star']);
  assert.equal(typeof plugin.activate, 'function');
});

test('package.json svgframe.contributes matches the manifest and the staged names', async () => {
  const manifest = await packageManifest();
  assert.equal(manifest.name, modifiedStarManifest.name);
  assert.equal(manifest.version, modifiedStarManifest.version);
  const declared = manifest.svgframe?.contributes?.decorators ?? [];
  assert.deepEqual(declared, ['modified-star']);
  const context = new FakePluginContext();
  plugin.activate(context);
  assert.deepEqual(context.treeDecorators.names(), declared);
});

test('two activations keep independent baselines', () => {
  const first = new FakePluginContext();
  const second = new FakePluginContext();
  plugin.activate(first);
  plugin.activate(second);
  first.publish(initialized(new SvgDocument(800, 600)));
  second.publish(saved(scene()));
  assert.deepEqual(
    new TreePresenter(first.treeDecorators).tree(scene()).some((line) => line.includes(' *')),
    true,
  );
  assert.deepEqual(
    new TreePresenter(second.treeDecorators).tree(scene()).some((line) => line.includes(' *')),
    false,
  );
});
