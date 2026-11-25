import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FakeDirectoryReader, FakePluginContext } from '@svgframe/core';
import plugin, { commandDirManifest, DirCommand, DirListing, DirPlugin } from '../index.js';

interface PackageManifest {
  name: string;
  version: string;
  svgframe?: { contributes?: { commands?: readonly string[] } };
}

async function packageManifest(): Promise<PackageManifest> {
  const source = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
  return JSON.parse(source) as PackageManifest;
}

test('activate registers only the dir command through the staged context', () => {
  const context = new FakePluginContext({}, undefined, new FakeDirectoryReader('/work'));
  plugin.activate(context);
  assert.deepEqual(context.commands.names(), ['dir']);
  assert.deepEqual(context.shapeProviders.names(), []);
  assert.deepEqual(context.treeDecorators.names(), []);
  assert.deepEqual(context.attributeHandlers.names(), []);
  const command = context.commands.require('dir');
  assert.ok(command instanceof DirCommand);
  assert.equal(command.usage, 'dir');
  assert.equal(command.prepare([]).requiresDocument, false);
});

test('default export is the plugin module with the shared manifest and no activation state', () => {
  assert.ok(plugin instanceof DirPlugin);
  assert.equal(plugin.manifest, commandDirManifest);
  assert.equal(plugin.manifest.name, '@svgframe/command-dir');
  assert.equal(plugin.manifest.version, '0.0.0');
  assert.deepEqual(plugin.manifest.contributes?.commands, ['dir']);
  assert.equal(typeof plugin.activate, 'function');
  const first = new FakePluginContext();
  const second = new FakePluginContext();
  plugin.activate(first);
  plugin.activate(second);
  assert.deepEqual(first.commands.names(), ['dir']);
  assert.deepEqual(second.commands.names(), ['dir']);
  assert.notEqual(first.commands.require('dir'), second.commands.require('dir'));
});

test('package.json declaration matches the core manifest and the registered names', async () => {
  const manifest = await packageManifest();
  assert.equal(manifest.name, commandDirManifest.name);
  assert.equal(manifest.version, commandDirManifest.version);
  const declared = manifest.svgframe?.contributes?.commands ?? [];
  assert.deepEqual(declared, ['dir']);
  const context = new FakePluginContext();
  plugin.activate(context);
  assert.deepEqual(context.commands.names(), declared);
});

test('exported listing stays usable for independent consumers', async () => {
  const reader = new FakeDirectoryReader('/work', { '/work': [] });
  assert.deepEqual(await new DirListing().render(reader), ['(empty directory)']);
});
