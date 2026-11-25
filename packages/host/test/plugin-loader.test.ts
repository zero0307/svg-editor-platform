import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { PluginLoader, type PluginInstallResult } from '../index.js';
import {
  cleanUp,
  createHost,
  createWorkspace,
  importDefault,
  pluginPackage,
  writeConfig,
  writePlugin,
  writeRawConfig,
  type FixturePlugin,
} from './PluginFixtures.js';

const goodPlugin = (name: string, commandName: string): FixturePlugin => ({
  name,
  contributions: { commands: [commandName] },
  moduleSource: `export default { activate(context) { context.commands.register({ name: '${commandName}' }); } };`,
});

const expectError = (result: PluginInstallResult) => {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected a failed plugin result');
  return result.error;
};

const load = async (
  host: ReturnType<typeof createHost>,
  configPath: string,
): Promise<readonly PluginInstallResult[]> =>
  new PluginLoader(host.installer).loadFromConfig(configPath);

test('loads entries in config order and continues after a missing module', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, goodPlugin('before', 'before'));
  await writePlugin(workspace, goodPlugin('after', 'after'));
  const config = await writeConfig(workspace, [
    { module: './before/index.mjs' },
    { module: './missing/index.mjs' },
    { module: './after/index.mjs' },
  ]);
  const host = createHost();
  const results = await load(host, config);
  assert.equal(results.length, 3);
  assert.equal(results[0]!.ok, true);
  const missing = expectError(results[1]!);
  assert.equal(missing.code, 'module-not-found');
  assert.equal(missing.message, 'plugin not found: ./missing/index.mjs');
  assert.equal(results[2]!.ok, true);
  assert.deepEqual(host.commands.names(), ['before', 'after']);
});

test('reports a module without a default export and keeps loading later entries', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, {
    name: 'no-default',
    moduleSource: 'export const activate = () => {};',
  });
  await writePlugin(workspace, goodPlugin('after', 'after'));
  const config = await writeConfig(workspace, [
    { module: './no-default/index.mjs' },
    { module: './after/index.mjs' },
  ]);
  const host = createHost();
  const results = await load(host, config);
  const error = expectError(results[0]!);
  assert.equal(error.code, 'missing-default-export');
  assert.equal(error.message, 'plugin has no default export: no-default');
  assert.equal(results[1]!.ok, true);
  assert.deepEqual(host.commands.names(), ['after']);
});

test('distinguishes top-level evaluation and internal dependency failures from not found', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, {
    name: 'top-throw',
    moduleSource: 'throw new Error("top level boom");',
  });
  await writePlugin(workspace, {
    name: 'internal-missing',
    moduleSource: "import './internal-missing.mjs';\nexport default { activate() {} };",
  });
  const config = await writeConfig(workspace, [
    { module: './top-throw/index.mjs' },
    { module: './internal-missing/index.mjs' },
    { module: './not-there/index.mjs' },
  ]);
  const host = createHost();
  const results = await load(host, config);
  const topThrow = expectError(results[0]!);
  assert.equal(topThrow.code, 'activation-failed');
  assert.equal(topThrow.message, 'plugin failed to activate: top-throw (top level boom)');
  const internalMissing = expectError(results[1]!);
  assert.equal(internalMissing.code, 'activation-failed');
  assert.match(internalMissing.message, /^plugin failed to activate: internal-missing \(/);
  const notFound = expectError(results[2]!);
  assert.equal(notFound.code, 'module-not-found');
  assert.equal(notFound.message, 'plugin not found: ./not-there/index.mjs');
});

test('rejects invalid JSON and returns the frozen invalid-config message', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const config = await writeRawConfig(workspace, '{ "plugins": [');
  const host = createHost();
  const results = await load(host, config);
  assert.equal(results.length, 1);
  const error = expectError(results[0]!);
  assert.equal(error.code, 'invalid-config');
  assert.equal(error.message, 'invalid plugin config');
  assert.deepEqual(host.commands.names(), []);
});

test('rejects invalid config structures without partially loading plugins', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, goodPlugin('good', 'good'));
  const cases = [
    { plugins: {} },
    { plugins: [{ module: 42 }] },
    { plugins: [{ module: './good/index.mjs', options: [] }] },
    { plugins: [{ module: './good/index.mjs', enabled: 'yes' }] },
  ];
  for (const value of cases) {
    const config = await writeRawConfig(workspace, JSON.stringify(value));
    const host = createHost();
    const results = await load(host, config);
    assert.equal(results.length, 1);
    const error = expectError(results[0]!);
    assert.equal(error.code, 'invalid-config');
    assert.equal(error.message, 'invalid plugin config');
    assert.deepEqual(host.commands.names(), []);
  }
});

test('reports a malformed package manifest as an activation failure', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const { directory } = await writePlugin(workspace, {
    name: 'broken-manifest',
    moduleSource: 'export default { activate() {} };',
  });
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'broken-manifest' }),
  );
  const config = await writeConfig(workspace, [{ module: './broken-manifest/index.mjs' }]);
  const host = createHost();
  const results = await load(host, config);
  const error = expectError(results[0]!);
  assert.equal(error.code, 'activation-failed');
  assert.match(
    error.message,
    /^plugin failed to activate: broken-manifest \(invalid plugin manifest: version must be a non-empty string\)$/,
  );
});

test('skips enabled:false without resolving or evaluating the module', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, goodPlugin('before', 'before'));
  await writePlugin(workspace, {
    name: 'disabled-throws',
    moduleSource: 'throw new Error("must not be imported");',
  });
  await writePlugin(workspace, goodPlugin('after', 'after'));
  const config = await writeConfig(workspace, [
    { module: './before/index.mjs' },
    { module: './disabled-throws/index.mjs', enabled: false },
    { module: './after/index.mjs' },
  ]);
  const host = createHost();
  const results = await load(host, config);
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => (result.ok ? result.name : result.error.code)),
    ['before', 'after'],
  );
  assert.deepEqual(host.commands.names(), ['before', 'after']);
});

test('resolves relative modules against the config directory', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, goodPlugin('good', 'good'));
  const config = await writeConfig(workspace, [{ module: '../good/index.mjs' }], {
    subdirectory: 'config',
  });
  const host = createHost();
  const results = await load(host, config);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.ok, true);
  assert.deepEqual(host.commands.names(), ['good']);
});

test('resolves a bare package specifier from the config directory', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const packageDirectory = path.join(workspace, 'node_modules', 'fixture-good');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    path.join(packageDirectory, 'package.json'),
    JSON.stringify({
      name: 'fixture-good',
      version: '0.0.1',
      main: 'index.mjs',
      svgframe: { contributes: { commands: ['bare'] } },
    }),
  );
  await writeFile(
    path.join(packageDirectory, 'index.mjs'),
    "export default { activate(context) { context.commands.register({ name: 'bare' }); } };",
  );
  const config = await writeConfig(workspace, [{ module: 'fixture-good' }]);
  const host = createHost();
  const results = await load(host, config);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.ok, true);
  assert.deepEqual(host.commands.names(), ['bare']);
});

test('passes read-only options from the config entry', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, {
    name: 'options',
    contributions: { commands: ['flagged'] },
    moduleSource: `export default { activate(context) {
      if (context.options.flag !== true) throw new Error('flag missing');
      if (!Object.isFrozen(context.options)) throw new Error('options not frozen');
      context.commands.register({ name: 'flagged' });
    } };`,
  });
  const config = await writeConfig(workspace, [
    { module: './options/index.mjs', options: { flag: true } },
  ]);
  const host = createHost();
  const results = await load(host, config);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.ok, true);
  assert.deepEqual(host.commands.names(), ['flagged']);
});

test('keeps subscriptions of a failed loader plugin off the live bus', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, {
    name: 'subscribes-then-throws',
    contributions: { commands: ['bad'] },
    moduleSource: `export default { activate(context) {
      context.commands.register({ name: 'bad' });
      context.subscribe(() => { throw new Error('must not be called'); });
      throw new Error('boom');
    } };`,
  });
  const config = await writeConfig(workspace, [{ module: './subscribes-then-throws/index.mjs' }]);
  const host = createHost();
  const results = await load(host, config);
  const error = expectError(results[0]!);
  assert.equal(error.code, 'activation-failed');
  assert.equal(host.events.observerCount, 0);
  assert.deepEqual(host.commands.names(), []);
});

test('rolls back every failure category between two good plugins', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  await writePlugin(workspace, goodPlugin('before', 'taken'));
  await writePlugin(workspace, {
    name: 'no-default',
    moduleSource: 'export const activate = () => {};',
  });
  await writePlugin(workspace, {
    name: 'bad-default',
    moduleSource: 'export default { activate: 42 };',
  });
  await writePlugin(workspace, {
    name: 'mismatch',
    contributions: { commands: ['declared'] },
    moduleSource:
      "export default { activate(context) { context.commands.register({ name: 'actual' }); } };",
  });
  await writePlugin(workspace, {
    name: 'activate-throws',
    contributions: { commands: ['boom'] },
    moduleSource: `export default { activate(context) {
      context.commands.register({ name: 'boom' });
      context.subscribe(() => { throw new Error('must not run'); });
      throw new Error('boom');
    } };`,
  });
  await writePlugin(workspace, {
    name: 'duplicate-global',
    contributions: { commands: ['taken'] },
    moduleSource:
      "export default { activate(context) { context.commands.register({ name: 'taken' }); } };",
  });
  await writePlugin(workspace, {
    name: 'duplicate-internal',
    contributions: { commands: ['dup'] },
    moduleSource: `export default { activate(context) {
      context.commands.register({ name: 'dup' });
      context.commands.register({ name: 'dup' });
    } };`,
  });
  await writePlugin(workspace, {
    name: 'top-throw',
    moduleSource: 'throw new Error("top level boom");',
  });
  await writePlugin(workspace, {
    name: 'internal-missing',
    moduleSource: "import './missing-internal.mjs';\nexport default { activate() {} };",
  });
  await writePlugin(workspace, goodPlugin('after', 'after'));
  const config = await writeConfig(workspace, [
    { module: './before/index.mjs' },
    { module: './missing/index.mjs' },
    { module: './no-default/index.mjs' },
    { module: './bad-default/index.mjs' },
    { module: './mismatch/index.mjs' },
    { module: './activate-throws/index.mjs' },
    { module: './duplicate-global/index.mjs' },
    { module: './duplicate-internal/index.mjs' },
    { module: './top-throw/index.mjs' },
    { module: './internal-missing/index.mjs' },
    { module: './after/index.mjs' },
  ]);
  const host = createHost();
  const results = await load(host, config);
  assert.equal(results.length, 11);
  assert.equal(results[0]!.ok, true);
  assert.equal(results[10]!.ok, true);
  assert.deepEqual(
    results.slice(1, -1).map((result) => expectError(result).code),
    [
      'module-not-found',
      'missing-default-export',
      'activation-failed',
      'manifest-mismatch',
      'activation-failed',
      'duplicate-registration',
      'duplicate-registration',
      'activation-failed',
      'activation-failed',
    ],
  );
  assert.deepEqual(host.commands.names(), ['taken', 'after']);
  assert.deepEqual(host.shapeProviders.names(), []);
  assert.deepEqual(host.treeDecorators.names(), []);
  assert.deepEqual(host.attributeHandlers.names(), []);
  assert.equal(host.events.observerCount, 0);
});

test('A and B produce identical results and registrations for the same plugins', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => cleanUp(workspace));
  const good = await writePlugin(workspace, goodPlugin('parity-good', 'parity'));
  const mismatch = await writePlugin(workspace, {
    name: 'parity-mismatch',
    contributions: { commands: ['declared'] },
    moduleSource:
      "export default { activate(context) { context.commands.register({ name: 'actual' }); } };",
  });
  const config = await writeConfig(workspace, [
    { module: './parity-good/index.mjs' },
    { module: './parity-mismatch/index.mjs' },
  ]);
  const hostB = createHost();
  const resultsB = await load(hostB, config);

  const hostA = createHost();
  const resultsA = await hostA.installer.installAll([
    {
      module: await importDefault(good.moduleFile),
      manifest: await pluginPackage(good.directory),
    },
    {
      module: await importDefault(mismatch.moduleFile),
      manifest: await pluginPackage(mismatch.directory),
    },
  ]);
  const messages = (results: readonly PluginInstallResult[]) =>
    results.map((result) =>
      result.ok ? `ok:${result.name}` : `${result.error.code}:${result.error.message}`,
    );
  assert.deepEqual(messages(resultsB), messages(resultsA));
  assert.deepEqual(hostB.commands.names(), hostA.commands.names());
});
