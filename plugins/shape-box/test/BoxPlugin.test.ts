import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FakePluginContext } from '@svgframe/core';
import plugin, {
  BoxAttributeHandler,
  BoxPlugin,
  BoxProvider,
  BoxTypeLabelDecorator,
  boxManifest,
} from '../index.js';

interface PackageManifest {
  name: string;
  version: string;
  svgframe?: {
    contributes?: {
      shapes?: readonly string[];
      attributes?: readonly string[];
      decorators?: readonly string[];
    };
  };
}

async function packageManifest(): Promise<PackageManifest> {
  const source = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
  return JSON.parse(source) as PackageManifest;
}

test('activate registers the three box contributions through the staged context', () => {
  const context = new FakePluginContext();
  plugin.activate(context);
  assert.deepEqual(context.shapeProviders.names(), ['box']);
  assert.deepEqual(context.attributeHandlers.names(), ['box-attributes']);
  assert.deepEqual(context.treeDecorators.names(), ['box-type-label']);
  assert.deepEqual(context.commands.names(), [], 'box contributes no command');
  assert.ok(context.shapeProviders.require('box') instanceof BoxProvider);
  assert.equal(context.shapeProviders.require('box').type, 'box');
  assert.ok(context.attributeHandlers.require('box-attributes') instanceof BoxAttributeHandler);
  assert.ok(context.treeDecorators.require('box-type-label') instanceof BoxTypeLabelDecorator);
});

test('default export is the plugin module with the shared manifest', () => {
  assert.ok(plugin instanceof BoxPlugin);
  assert.equal(plugin.manifest, boxManifest);
  assert.equal(plugin.manifest.name, '@svgframe/shape-box');
  assert.equal(plugin.manifest.version, '0.0.0');
  assert.deepEqual(plugin.manifest.contributes?.shapes, ['box']);
  assert.deepEqual(plugin.manifest.contributes?.attributeHandlers, ['box-attributes']);
  assert.deepEqual(plugin.manifest.contributes?.decorators, ['box-type-label']);
  assert.equal(typeof plugin.activate, 'function');
});

test('package.json svgframe.contributes matches the manifest and the staged names', async () => {
  const manifest = await packageManifest();
  assert.equal(manifest.name, boxManifest.name);
  assert.equal(manifest.version, boxManifest.version);
  const contributes = manifest.svgframe?.contributes ?? {};
  assert.deepEqual(contributes.shapes ?? [], ['box']);
  assert.deepEqual(contributes.attributes ?? [], ['box-attributes']);
  assert.deepEqual(contributes.decorators ?? [], ['box-type-label']);
  const context = new FakePluginContext();
  plugin.activate(context);
  assert.deepEqual(context.shapeProviders.names(), contributes.shapes ?? []);
  assert.deepEqual(context.attributeHandlers.names(), contributes.attributes ?? []);
  assert.deepEqual(context.treeDecorators.names(), contributes.decorators ?? []);
});

test('two activations stay independent and register no extra capability', () => {
  const first = new FakePluginContext();
  const second = new FakePluginContext();
  plugin.activate(first);
  plugin.activate(second);
  assert.notEqual(first.shapeProviders.require('box'), second.shapeProviders.require('box'));
  assert.equal(first.attributeHandlers.names().length, 1);
  assert.equal(first.treeDecorators.names().length, 1);
});
