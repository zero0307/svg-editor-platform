import { StatsCommand } from './StatsCommand.js';
import { commandStatsManifest } from './StatsManifest.js';
import type { PluginContext, PluginManifest, PluginModule } from '@svgframe/core';

/**
 * Plugin module for `@svgframe/command-stats`.
 *
 * `activate` only registers the command through the staged context the host
 * passes in; it never touches the live command table, the filesystem, the
 * document or the event bus. The installer validates the manifest and either
 * commits the registration or drops it with the rest of the staging area, so A
 * (explicit module) and B (configuration) share one path.
 */
export class StatsPlugin implements PluginModule {
  readonly manifest: PluginManifest = commandStatsManifest;
  activate(context: PluginContext): void {
    context.commands.register(new StatsCommand());
  }
}
