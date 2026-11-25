import { BuiltinsPlugin, builtinsManifest } from '@svgframe/builtins';
import {
  AttributeHandlerRegistry,
  CommandRegistry,
  DomainError,
  EditorSession,
  ProviderShapeCreationService,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
} from '@svgframe/core';
import {
  LocalDirectoryReader,
  LocalFileStore,
  PluginInstaller,
  PluginLoader,
} from '@svgframe/host';
import { XmlSvgCodec } from '@svgframe/svg-xml';
import { CommandDispatcher } from './CommandDispatcher.js';
import type { DirectoryReader, EditorSessionPort, FileStore } from '@svgframe/core';
import type { PluginInstallRequest, PluginInstallResult } from '@svgframe/host';

/** Composition options shared by the explicit (A) and config (B) roots. */
export interface ApplicationOptions {
  readonly files?: FileStore;
  readonly directories?: DirectoryReader;
  /** A-root explicit plugin modules; B-root reads `configPath` instead. */
  readonly embeddedPlugins?: readonly PluginInstallRequest[];
  /** When set, this is the B-root configuration file. */
  readonly configPath?: string;
  readonly onPluginError?: (message: string) => void;
}

export interface Application {
  readonly session: EditorSessionPort;
  readonly commands: CommandRegistry;
  readonly dispatcher: CommandDispatcher;
  readonly installer: PluginInstaller;
  readonly results: readonly PluginInstallResult[];
}

/**
 * Builds the default capability set and installs it through the shared
 * `PluginInstaller`, exactly like optional plugins. A additionally installs the
 * explicit `embeddedPlugins` modules; B loads `configPath` through `PluginLoader`.
 */
export async function createApplication(options: ApplicationOptions = {}): Promise<Application> {
  const shapeProviders = new ShapeProviderRegistry();
  const commands = new CommandRegistry();
  const treeDecorators = new TreeDecoratorRegistry();
  const attributeHandlers = new AttributeHandlerRegistry();
  const shapes = new ProviderShapeCreationService(shapeProviders);
  const codec = new XmlSvgCodec(shapeProviders);
  const session = new EditorSession(options.files ?? new LocalFileStore(), codec);
  const directories = options.directories ?? new LocalDirectoryReader();
  const installer = new PluginInstaller({
    shapeProviders,
    commands,
    treeDecorators,
    attributeHandlers,
    shapes,
    directories,
    events: session.events,
  });
  const builtins = new BuiltinsPlugin({
    commands,
    shapeProviders,
    treeDecorators,
    attributeHandlers,
  });
  const builtinsResult = await installer.install({
    module: builtins,
    manifest: builtinsManifest,
  });
  if (!builtinsResult.ok)
    throw new DomainError(`built-in plugin failed: ${builtinsResult.error.message}`);
  const results: PluginInstallResult[] = [builtinsResult];
  if (options.configPath === undefined) {
    results.push(...(await installer.installAll(options.embeddedPlugins ?? [])));
  } else {
    results.push(...(await new PluginLoader(installer).loadFromConfig(options.configPath)));
  }
  for (const result of results) {
    if (!result.ok) options.onPluginError?.(result.error.message);
  }
  return {
    session,
    commands,
    dispatcher: new CommandDispatcher(commands, session),
    installer,
    results,
  };
}
