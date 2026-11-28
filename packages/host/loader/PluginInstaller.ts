import {
  AttributeHandlerRegistry,
  CommandRegistry,
  DuplicateRegistrationError,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
} from '@svgframe/core';
import type {
  DirectoryReader,
  EditorEvents,
  PluginManifest,
  PluginModule,
  ShapeCreationService,
} from '@svgframe/core';
import { PluginLoadError } from './PluginLoadError.js';
import { normalizePluginManifest } from './PluginManifest.js';
import { StagedPluginContext } from './StagedPluginContext.js';
import type { PluginInstallResult } from './PluginInstallResult.js';

/** Live tables and ports the installer publishes into. */
export interface PluginInstallationServices {
  readonly shapeProviders: ShapeProviderRegistry;
  readonly commands: CommandRegistry;
  readonly treeDecorators: TreeDecoratorRegistry;
  readonly attributeHandlers: AttributeHandlerRegistry;
  readonly shapes: ShapeCreationService;
  readonly directories: DirectoryReader;
  readonly events: EditorEvents;
}

/** One plugin candidate: A passes module objects, B resolves them first. */
export interface PluginInstallRequest {
  readonly module: unknown;
  readonly manifest: unknown;
  readonly options?: Readonly<Record<string, unknown>>;
}

type Category = 'shapes' | 'commands' | 'decorators' | 'attributes';

/** Deterministic order for comparisons, duplicate reports and mismatch output. */
const categoryOrder: readonly Category[] = ['attributes', 'commands', 'decorators', 'shapes'];

/** Registration order of the four live tables; Phase 1 order is preserved. */
const registrationOrder: readonly Category[] = ['shapes', 'commands', 'decorators', 'attributes'];

const registryCategory: Readonly<Record<string, Category>> = {
  'shape provider': 'shapes',
  command: 'commands',
  'tree decorator': 'decorators',
  'attribute handler': 'attributes',
};

interface CategoryHandle {
  names(): readonly string[];
  hasGlobal(name: string): boolean;
  commit(): void;
}

/**
 * Shared A/B plugin installation transaction.
 *
 * Every plugin activates against a staged context. The installer validates the
 * manifest, the default export and the activation, then checks global and
 * per-plugin duplicate names, compares the declared contribution names with the
 * staged ones and finally publishes the four registration tables once. A failure
 * discards the staging area (including staged event subscriptions) and returns a
 * structured error, so the caller can print it and continue with later plugins.
 */
export class PluginInstaller {
  constructor(private readonly services: PluginInstallationServices) {}

  async install(request: PluginInstallRequest): Promise<PluginInstallResult> {
    let manifest: PluginManifest;
    try {
      manifest = normalizePluginManifest(request.manifest);
    } catch (error) {
      return this.failure(
        'activation-failed',
        `plugin failed to activate: ${this.manifestLabel(request.manifest)} (${reason(error)})`,
      );
    }

    const plugin = request.module as Partial<PluginModule> | null | undefined;
    if (plugin === null || plugin === undefined)
      return this.failure(
        'missing-default-export',
        `plugin has no default export: ${manifest.name}`,
      );
    if (typeof plugin !== 'object' || typeof plugin.activate !== 'function')
      return this.failure(
        'activation-failed',
        `plugin failed to activate: ${manifest.name} (default export has no activate function)`,
      );

    const context = new StagedPluginContext(
      this.services.shapes,
      this.services.directories,
      request.options ?? {},
    );
    try {
      await plugin.activate(context);
    } catch (error) {
      context.discard();
      if (error instanceof DuplicateRegistrationError)
        return this.failure(
          'duplicate-registration',
          `duplicate registration: ${categoryOfRegistryKind(error.kind)}/${error.contributionName}`,
        );
      return this.failure(
        'activation-failed',
        `plugin failed to activate: ${manifest.name} (${reason(error)})`,
      );
    }

    const handles = this.handles(context);
    for (const category of categoryOrder) {
      const handle = handles.get(category)!;
      for (const name of [...handle.names()].sort()) {
        if (!handle.hasGlobal(name)) continue;
        context.discard();
        return this.failure(
          'duplicate-registration',
          `duplicate registration: ${category}/${name}`,
        );
      }
    }

    const declared = this.declaredContributions(manifest);
    const registered = this.registeredContributions(handles);
    for (const category of categoryOrder) {
      if (sameNames(declared[category], registered[category])) continue;
      context.discard();
      return this.failure(
        'manifest-mismatch',
        `plugin manifest mismatch: ${manifest.name} (declared: ${formatContributions(
          declared,
        )}; registered: ${formatContributions(registered)})`,
      );
    }

    try {
      for (const category of registrationOrder) handles.get(category)!.commit();
    } catch (error) {
      context.discard();
      return this.failure(
        'activation-failed',
        `plugin failed to activate: ${manifest.name} (commit failed: ${reason(error)})`,
      );
    }
    context.connect(this.services.events);
    return { ok: true, name: manifest.name };
  }

  /** A-mode entry: install an explicit list in order and keep going after failures. */
  async installAll(
    requests: readonly PluginInstallRequest[],
  ): Promise<readonly PluginInstallResult[]> {
    const results: PluginInstallResult[] = [];
    for (const request of requests) results.push(await this.install(request));
    return results;
  }

  private handles(context: StagedPluginContext): ReadonlyMap<Category, CategoryHandle> {
    const services = this.services;
    return new Map<Category, CategoryHandle>([
      [
        'shapes',
        {
          names: () => context.shapeProviders.names(),
          hasGlobal: (name) => services.shapeProviders.has(name),
          commit: () => {
            for (const contribution of context.shapeProviders.entries())
              services.shapeProviders.register(contribution);
          },
        },
      ],
      [
        'commands',
        {
          names: () => context.commands.names(),
          hasGlobal: (name) => services.commands.has(name),
          commit: () => {
            for (const contribution of context.commands.entries())
              services.commands.register(contribution);
          },
        },
      ],
      [
        'decorators',
        {
          names: () => context.treeDecorators.names(),
          hasGlobal: (name) => services.treeDecorators.has(name),
          commit: () => {
            for (const contribution of context.treeDecorators.entries())
              services.treeDecorators.register(contribution);
          },
        },
      ],
      [
        'attributes',
        {
          names: () => context.attributeHandlers.names(),
          hasGlobal: (name) => services.attributeHandlers.has(name),
          commit: () => {
            for (const contribution of context.attributeHandlers.entries())
              services.attributeHandlers.register(contribution);
          },
        },
      ],
    ]);
  }

  private declaredContributions(manifest: PluginManifest): Record<Category, readonly string[]> {
    return {
      shapes: manifest.contributes?.shapes ?? [],
      commands: manifest.contributes?.commands ?? [],
      decorators: manifest.contributes?.decorators ?? [],
      attributes: manifest.contributes?.attributeHandlers ?? [],
    };
  }

  private registeredContributions(
    handles: ReadonlyMap<Category, CategoryHandle>,
  ): Record<Category, readonly string[]> {
    return {
      shapes: handles.get('shapes')!.names(),
      commands: handles.get('commands')!.names(),
      decorators: handles.get('decorators')!.names(),
      attributes: handles.get('attributes')!.names(),
    };
  }

  private failure(code: PluginLoadError['code'], message: string): PluginInstallResult {
    return { ok: false, error: new PluginLoadError(code, message) };
  }

  private manifestLabel(manifest: unknown): string {
    const name = (manifest as { name?: unknown } | null)?.name;
    return typeof name === 'string' && name ? name : 'plugin';
  }
}

const categoryOfRegistryKind = (kind: string): Category => registryCategory[kind] ?? 'shapes';

const sameNames = (left: readonly string[], right: readonly string[]): boolean => {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((name, index) => name === b[index]);
};

const formatContributions = (values: Record<Category, readonly string[]>): string =>
  categoryOrder
    .map((category) => `${category}=[${[...values[category]].sort().join(', ')}]`)
    .join(', ');

const reason = (error: unknown): string =>
  String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, ' ');
