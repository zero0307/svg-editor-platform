import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PluginManifest } from '@svgframe/core';
import { parsePluginConfig, type PluginConfigEntry } from './PluginConfig.js';
import { PluginLoadError } from './PluginLoadError.js';
import { normalizePluginManifest } from './PluginManifest.js';
import type { PluginInstallResult } from './PluginInstallResult.js';
import type { PluginInstaller } from './PluginInstaller.js';

/**
 * B-mode plugin loader.
 *
 * The loader only reads/validates `plugins.config.json`, resolves each module
 * relative to the config file, reads the plugin package manifest and then hands
 * the module object to the same `PluginInstaller` used by A. It never imports a
 * concrete plugin and has no name mapping table.
 *
 * Module resolution failure is reported as `plugin not found`; once a module is
 * found, evaluation or internal dependency failures are reported as activation
 * failures so they are not misclassified as missing plugins. `enabled: false`
 * entries are skipped before resolution or import.
 */
export class PluginLoader {
  constructor(private readonly installer: PluginInstaller) {}

  async loadFromConfig(configPath: string): Promise<readonly PluginInstallResult[]> {
    let entries: readonly PluginConfigEntry[];
    try {
      entries = parsePluginConfig(await readFile(configPath, 'utf8')).plugins;
    } catch {
      return [this.failure('invalid-config', 'invalid plugin config')];
    }
    const baseDirectory = path.dirname(path.resolve(configPath));
    const results: PluginInstallResult[] = [];
    for (const entry of entries) {
      if (entry.enabled === false) continue;
      results.push(await this.installEntry(baseDirectory, entry));
    }
    return results;
  }

  private async installEntry(
    baseDirectory: string,
    entry: PluginConfigEntry,
  ): Promise<PluginInstallResult> {
    let moduleFile: string;
    try {
      moduleFile = await this.resolveModule(baseDirectory, entry.module);
    } catch {
      return this.failure('module-not-found', `plugin not found: ${entry.module}`);
    }

    let manifest: PluginManifest;
    let rawManifest: unknown;
    try {
      rawManifest = await this.readPackageManifest(moduleFile);
      manifest = normalizePluginManifest(rawManifest);
    } catch (error) {
      return this.failure(
        'activation-failed',
        `plugin failed to activate: ${manifestLabel(rawManifest) ?? entry.module} (${reason(error)})`,
      );
    }

    let namespace: Record<string, unknown>;
    try {
      namespace = (await import(pathToFileURL(moduleFile).href)) as Record<string, unknown>;
    } catch (error) {
      return this.failure(
        'activation-failed',
        `plugin failed to activate: ${manifest.name} (${reason(error)})`,
      );
    }
    if (!('default' in namespace) || namespace.default === undefined)
      return this.failure(
        'missing-default-export',
        `plugin has no default export: ${manifest.name}`,
      );
    return this.installer.install({
      module: namespace.default,
      manifest,
      options: entry.options,
    });
  }

  private async resolveModule(baseDirectory: string, request: string): Promise<string> {
    if (request.startsWith('.') || path.isAbsolute(request)) {
      const candidate = path.resolve(baseDirectory, request);
      const info = await stat(candidate).catch(() => undefined);
      if (!info) throw new Error('not found');
      if (info.isFile()) return candidate;
      if (!info.isDirectory()) throw new Error('not found');
      const directoryManifest = await this.readJson(path.join(candidate, 'package.json')).catch(
        () => undefined,
      );
      const entry = PluginLoader.entryOf(directoryManifest);
      if (!entry) throw new Error('not found');
      const resolved = path.resolve(candidate, entry);
      const resolvedInfo = await stat(resolved).catch(() => undefined);
      if (!resolvedInfo?.isFile()) throw new Error('not found');
      return resolved;
    }
    try {
      return createRequire(path.join(baseDirectory, 'plugin-loader.cjs')).resolve(request);
    } catch {
      throw new Error('not found');
    }
  }

  private async readPackageManifest(moduleFile: string): Promise<unknown> {
    let directory = path.dirname(moduleFile);
    for (;;) {
      const candidate = path.join(directory, 'package.json');
      const text = await readFile(candidate, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error?.code === 'ENOENT') return undefined;
        throw error;
      });
      if (text !== undefined) return JSON.parse(text.replace(/^\uFEFF/, ''));
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error('package.json not found');
      directory = parent;
    }
  }

  private async readJson(file: string): Promise<unknown> {
    return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  }

  private static entryOf(manifest: unknown): string | undefined {
    if (typeof manifest !== 'object' || manifest === null) return undefined;
    const value = manifest as Record<string, unknown>;
    if (typeof value.main === 'string' && value.main) return value.main;
    const exportsField = value.exports;
    if (typeof exportsField === 'string' && exportsField) return exportsField;
    if (typeof exportsField !== 'object' || exportsField === null) return undefined;
    const root = (exportsField as Record<string, unknown>)['.'];
    if (typeof root === 'string' && root) return root;
    if (typeof root !== 'object' || root === null) return undefined;
    for (const key of ['import', 'default']) {
      const target = (root as Record<string, unknown>)[key];
      if (typeof target === 'string' && target) return target;
    }
    return undefined;
  }

  private failure(code: PluginLoadError['code'], message: string): PluginInstallResult {
    return { ok: false, error: new PluginLoadError(code, message) };
  }
}

const reason = (error: unknown): string =>
  String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, ' ');

const manifestLabel = (value: unknown): string | undefined => {
  const name = (value as { name?: unknown } | null | undefined)?.name;
  return typeof name === 'string' && name ? name : undefined;
};
