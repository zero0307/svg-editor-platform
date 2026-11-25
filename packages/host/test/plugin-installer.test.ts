import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { SvgDocument } from '@svgframe/core';
import {
  cleanUp,
  createHost,
  createWorkspace,
  importDefault,
  importPlugin,
  pluginPackage,
  writePlugin,
  type FixturePlugin,
} from './PluginFixtures.js';
import type { PluginInstallResult } from '../index.js';

const command = (name: string): string => `context.commands.register({ name: '${name}' });`;
const decorator = (name: string): string => `context.treeDecorators.register({ name: '${name}' });`;

const install = async (
  host: ReturnType<typeof createHost>,
  workspace: string,
  fixture: FixturePlugin,
  options?: Readonly<Record<string, unknown>>,
): Promise<{ readonly result: PluginInstallResult; readonly moduleFile: string }> => {
  const { moduleFile } = await writePlugin(workspace, fixture);
  const module = await importDefault(moduleFile);
  const manifest = await pluginPackage(path.dirname(moduleFile));
  const result = await host.installer.install({ module, manifest, options });
  return { result, moduleFile };
};

const goodPlugin = (name: string, commandName: string): FixturePlugin => ({
  name,
  contributions: { commands: [commandName] },
  moduleSource: `export default { activate(context) { ${command(commandName)} } };`,
});

test('installs a plugin, passes frozen options and connects staged subscriptions', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result, moduleFile } = await install(
    host,
    workspace,
    {
      name: 'good',
      contributions: { commands: ['alpha'] },
      moduleSource: `export const received = [];
        export default {
          activate(context) {
            if (context.options.flag !== true) throw new Error('flag missing');
            if (!Object.isFrozen(context.options)) throw new Error('options not frozen');
            ${command('alpha')}
            context.subscribe((event) => received.push(event.type));
          }
        };`,
    },
    { flag: true },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(host.commands.names(), ['alpha']);
  assert.equal(host.events.observerCount, 1);
  host.events.publish({
    type: 'editCommitted',
    document: new SvgDocument(),
    message: 'edited',
  });
  const plugin = await importPlugin(moduleFile);
  assert.deepEqual(plugin.received, ['editCommitted']);
});

test('rejects a plugin without a default export using the frozen message', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'no-default',
    moduleSource: 'export const activate = () => {};',
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'missing-default-export');
  assert.equal(result.error.message, 'plugin has no default export: no-default');
});

test('rejects a default export without an activate function', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'bad-default',
    moduleSource: 'export default { activate: 42 };',
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'activation-failed');
  assert.equal(
    result.error.message,
    'plugin failed to activate: bad-default (default export has no activate function)',
  );
});

test('reports a manifest mismatch with sorted declared and registered names', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'mismatch',
    contributions: { commands: ['declared'] },
    moduleSource: `export default { activate(context) { ${command('actual')} } };`,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'manifest-mismatch');
  assert.equal(
    result.error.message,
    'plugin manifest mismatch: mismatch (declared: attributes=[], commands=[declared], ' +
      'decorators=[], shapes=[]; registered: attributes=[], commands=[actual], ' +
      'decorators=[], shapes=[])',
  );
  assert.deepEqual(host.commands.names(), []);
});

test('rejects a name already registered by a previous plugin', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const before = await install(host, workspace, goodPlugin('good-before', 'taken'));
  assert.equal(before.result.ok, true);
  const duplicate = await install(host, workspace, {
    name: 'duplicate-global',
    contributions: { commands: ['taken'] },
    moduleSource: `export default { activate(context) { ${command('taken')} } };`,
  });
  assert.equal(duplicate.result.ok, false);
  if (duplicate.result.ok) return;
  assert.equal(duplicate.result.error.code, 'duplicate-registration');
  assert.equal(duplicate.result.error.message, 'duplicate registration: commands/taken');
  assert.deepEqual(host.commands.names(), ['taken']);
});

test('rejects a plugin that registers the same name twice', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'duplicate-internal',
    contributions: { commands: ['alpha'] },
    moduleSource: `export default { activate(context) { ${command('alpha')} ${command('alpha')} } };`,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'duplicate-registration');
  assert.equal(result.error.message, 'duplicate registration: commands/alpha');
  assert.deepEqual(host.commands.names(), []);
});

test('rolls back registrations and staged subscriptions after activate throws', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const before = await install(host, workspace, goodPlugin('good-before', 'before'));
  assert.equal(before.result.ok, true);
  const failed = await install(host, workspace, {
    name: 'activate-throws',
    contributions: { commands: ['bad'] },
    moduleSource: `export const received = [];
      export default {
        activate(context) {
          ${command('bad')}
          context.subscribe(() => received.push('event'));
          throw new Error('boom');
        }
      };`,
  });
  assert.equal(failed.result.ok, false);
  if (failed.result.ok) return;
  assert.equal(failed.result.error.code, 'activation-failed');
  assert.equal(failed.result.error.message, 'plugin failed to activate: activate-throws (boom)');
  assert.equal(host.events.observerCount, 0);
  host.events.publish({ type: 'editCommitted', document: new SvgDocument(), message: 'x' });
  const plugin = await importPlugin(failed.moduleFile);
  assert.deepEqual(plugin.received, []);
  const after = await install(host, workspace, goodPlugin('good-after', 'after'));
  assert.equal(after.result.ok, true);
  assert.deepEqual(host.commands.names(), ['before', 'after']);
});

test('compares declared names as a multiset instead of silently deduplicating', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'duplicate-declared',
    contributions: { commands: ['alpha', 'alpha'] },
    moduleSource: `export default { activate(context) { ${command('alpha')} } };`,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'manifest-mismatch');
  assert.match(result.error.message, /declared: .*commands=\[alpha, alpha\]/);
  assert.deepEqual(host.commands.names(), []);
});

test('accepts the same name in different categories', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'cross-category',
    contributions: { commands: ['same'], decorators: ['same'] },
    moduleSource: `export default { activate(context) { ${command('same')} ${decorator('same')} } };`,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(host.commands.names(), ['same']);
  assert.deepEqual(host.treeDecorators.names(), ['same']);
});

test('maps package.json attributes to core attributeHandlers', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'attributes',
    contributions: { attributes: ['attrs'] },
    moduleSource: `export default { activate(context) { context.attributeHandlers.register({ name: 'attrs' }); } };`,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(host.attributeHandlers.names(), ['attrs']);
});

test('accepts a core-shaped manifest with attributeHandlers', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { moduleFile } = await writePlugin(workspace, {
    name: 'core-shape',
    moduleSource: `export default { activate(context) { context.attributeHandlers.register({ name: 'attrs' }); } };`,
  });
  const module = await importDefault(moduleFile);
  const result = await host.installer.install({
    module,
    manifest: {
      name: 'core-shape',
      version: '0.0.1',
      contributes: { attributeHandlers: ['attrs'] },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(host.attributeHandlers.names(), ['attrs']);
});

test('drops a subscription disposed before commit', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const { result } = await install(host, workspace, {
    name: 'disposed',
    moduleSource: `export default { activate(context) {
      const detach = context.subscribe(() => { throw new Error('must not run'); });
      detach();
    } };`,
  });
  assert.equal(result.ok, true);
  assert.equal(host.events.observerCount, 0);
});

test('installAll keeps going after a failing plugin', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const host = createHost();
  const first = await writePlugin(workspace, goodPlugin('first', 'one'));
  const broken = await writePlugin(workspace, {
    name: 'broken',
    contributions: { commands: ['broken'] },
    moduleSource: 'export default { activate() { throw new Error("broken"); } };',
  });
  const third = await writePlugin(workspace, goodPlugin('third', 'three'));
  const results = await host.installer.installAll([
    {
      module: await importDefault(first.moduleFile),
      manifest: await pluginPackage(first.directory),
    },
    {
      module: await importDefault(broken.moduleFile),
      manifest: await pluginPackage(broken.directory),
    },
    {
      module: await importDefault(third.moduleFile),
      manifest: await pluginPackage(third.directory),
    },
  ]);
  assert.deepEqual(
    results.map((result) => (result.ok ? result.name : result.error.code)),
    ['first', 'activation-failed', 'third'],
  );
  assert.deepEqual(host.commands.names(), ['one', 'three']);
});
