import { CtxFsSvgFileGateway } from './CtxFsSvgFileGateway.js';
import type { DshPluginContext } from './DshContracts.js';
import { createToolDefinitions } from './ToolDefinitions.js';

/** Cordis plugin name used by loader diagnostics. */
export const name = 'svgframe-dsh-plugin';

/** Host capabilities required before this plugin activates; without `fs` it stays inactive. */
export const inject = ['tools', 'fs'];

/** Row config from the bundle patch. */
export interface DshPluginConfig {
  /** Log registration and disposal to host stdout; used by the lifecycle evidence run. */
  log?: boolean;
}

const PREFIX = '[svgframe-dsh]';

/**
 * Registers `svg_inspect` and `svg_create_flowchart` through the official DSH
 * entry (`apply` + `ctx.tools.register`), and returns one effect that releases
 * every registration on unload.
 */
export function apply(ctx: DshPluginContext, config: DshPluginConfig = {}): void {
  const log =
    config.log === true ? (message: string) => console.log(`${PREFIX} ${message}`) : () => {};
  const tools = createToolDefinitions(new CtxFsSvgFileGateway(ctx.fs));

  ctx.effect(() => {
    const disposers = tools.map((tool) => ctx.tools.register(tool));
    log(`registered ${tools.map((tool) => tool.name).join(', ')}`);
    return () => {
      for (const disposer of disposers) disposer?.();
      const residue = tools
        .filter((tool) => ctx.tools.get(tool.name) !== undefined)
        .map((tool) => tool.name);
      log(`disposed; registry-residue=${residue.length === 0 ? 'none' : residue.join(',')}`);
    };
  });
}
