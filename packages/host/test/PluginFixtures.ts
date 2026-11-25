import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  AttributeHandlerRegistry,
  CommandRegistry,
  EditorEventBus,
  FakeDirectoryReader,
  FakeShapeCreationService,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
} from '@svgframe/core';
import { PluginInstaller } from '../index.js';

export interface FixtureContributions {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly decorators?: readonly string[];
  readonly attributes?: readonly string[];
}

export interface FixturePlugin {
  readonly name: string;
  readonly contributions?: FixtureContributions;
  readonly moduleSource: string;
  readonly packageExtra?: Readonly<Record<string, unknown>>;
  readonly directory?: string;
}

export interface FixtureConfigEntry {
  readonly module: string;
  readonly options?: Readonly<Record<string, unknown>>;
  readonly enabled?: boolean;
}

export interface HostFixture {
  readonly installer: PluginInstaller;
  readonly events: EditorEventBus;
  readonly shapeProviders: ShapeProviderRegistry;
  readonly commands: CommandRegistry;
  readonly treeDecorators: TreeDecoratorRegistry;
  readonly attributeHandlers: AttributeHandlerRegistry;
}

/** Fresh live registries, event bus and fake ports for one installer test. */
export const createHost = (): HostFixture => {
  const events = new EditorEventBus();
  const shapeProviders = new ShapeProviderRegistry();
  const commands = new CommandRegistry();
  const treeDecorators = new TreeDecoratorRegistry();
  const attributeHandlers = new AttributeHandlerRegistry();
  const installer = new PluginInstaller({
    shapeProviders,
    commands,
    treeDecorators,
    attributeHandlers,
    shapes: new FakeShapeCreationService(),
    directories: new FakeDirectoryReader(),
    events,
  });
  return { installer, events, shapeProviders, commands, treeDecorators, attributeHandlers };
};

export const createWorkspace = (): Promise<string> =>
  mkdtemp(path.join(tmpdir(), 'svgframe-host-loader-'));

export const cleanUp = (directory: string): Promise<void> =>
  rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }).catch(
    () => undefined,
  );

export const writePlugin = async (
  workspace: string,
  fixture: FixturePlugin,
): Promise<{ directory: string; moduleFile: string }> => {
  const directory = path.join(workspace, fixture.directory ?? fixture.name);
  await mkdir(directory, { recursive: true });
  const packageJson = {
    name: fixture.name,
    version: '0.0.1',
    svgframe: { contributes: fixture.contributions ?? {} },
    ...(fixture.packageExtra ?? {}),
  };
  await writeFile(path.join(directory, 'package.json'), JSON.stringify(packageJson, null, 2));
  const moduleFile = path.join(directory, 'index.mjs');
  await writeFile(moduleFile, fixture.moduleSource);
  return { directory, moduleFile };
};

export const writeConfig = async (
  workspace: string,
  entries: readonly FixtureConfigEntry[],
  options: { readonly fileName?: string; readonly subdirectory?: string } = {},
): Promise<string> => {
  const directory = options.subdirectory ? path.join(workspace, options.subdirectory) : workspace;
  await mkdir(directory, { recursive: true });
  const configPath = path.join(directory, options.fileName ?? 'plugins.config.json');
  await writeFile(configPath, JSON.stringify({ plugins: entries }, null, 2));
  return configPath;
};

export const writeRawConfig = async (workspace: string, content: string): Promise<string> => {
  const configPath = path.join(workspace, 'plugins.config.json');
  await writeFile(configPath, content);
  return configPath;
};

export const pluginPackage = async (directory: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));

export const importPlugin = async (moduleFile: string): Promise<Record<string, unknown>> =>
  (await import(pathToFileURL(moduleFile).href)) as Record<string, unknown>;

export const importDefault = async (moduleFile: string): Promise<unknown> =>
  (await importPlugin(moduleFile)).default;
