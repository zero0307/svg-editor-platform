import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FakePluginContext, FakeShapeCreationService, SvgDocument } from '@svgframe/core';
import plugin, { StatsCommand, StatsPlugin, commandStatsManifest, StatsTally } from '../index.js';

interface PackageManifest {
  name: string;
  version: string;
  svgframe?: { contributes?: { commands?: readonly string[] } };
}

async function packageManifest(): Promise<PackageManifest> {
  const source = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
  return JSON.parse(source) as PackageManifest;
}

test('activate registers only the stats command through the staged context', () => {
  const context = new FakePluginContext();
  const shapes = context.shapes as FakeShapeCreationService;
  plugin.activate(context);
  assert.deepEqual(context.commands.names(), ['stats']);
  assert.deepEqual(context.shapeProviders.names(), []);
  assert.deepEqual(context.treeDecorators.names(), []);
  assert.deepEqual(context.attributeHandlers.names(), []);
  assert.equal(shapes.requests.length, 0, 'stats does not create shapes');
  const command = context.commands.require('stats');
  assert.ok(command instanceof StatsCommand);
  assert.equal(command.usage, 'stats');
  assert.equal(command.prepare([]).effect, 'query');
});

test('default export is the plugin module with the shared manifest and no activation state', () => {
  assert.ok(plugin instanceof StatsPlugin);
  assert.equal(plugin.manifest, commandStatsManifest);
  assert.equal(plugin.manifest.name, '@svgframe/command-stats');
  assert.equal(plugin.manifest.version, '0.0.0');
  assert.deepEqual(plugin.manifest.contributes?.commands, ['stats']);
  assert.equal(typeof plugin.activate, 'function');
  const first = new FakePluginContext();
  const second = new FakePluginContext();
  plugin.activate(first);
  plugin.activate(second);
  assert.deepEqual(first.commands.names(), ['stats']);
  assert.deepEqual(second.commands.names(), ['stats']);
  assert.notEqual(first.commands.require('stats'), second.commands.require('stats'));
});

test('package.json declaration matches the core manifest and the registered names', async () => {
  const manifest = await packageManifest();
  assert.equal(manifest.name, commandStatsManifest.name);
  assert.equal(manifest.version, commandStatsManifest.version);
  const declared = manifest.svgframe?.contributes?.commands ?? [];
  assert.deepEqual(declared, ['stats']);
  const context = new FakePluginContext();
  plugin.activate(context);
  assert.deepEqual(context.commands.names(), declared);
});

test('exported classes stay available for independent consumers', () => {
  assert.ok(new StatsTally() instanceof StatsTally);
  assert.equal(new StatsTally().report(new SvgDocument()), '(total 0, containers 0)');
});
