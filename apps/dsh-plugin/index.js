/**
 * Minimal DSH bundle for TASK-DSH-01.
 *
 * Responsibilities: register one structured tool, log the registration and the
 * release so a real DSH host can prove load/unload, and consume the editor
 * session through the local `EditorSessionPort` stand-in only.
 *
 * The pinned DSH version and the API differences observed while building this
 * bundle are recorded in `doc/dsh.md`.
 */

import { createRequire } from 'node:module';
import { createFakeEditorSession } from './editor-session-port.js';

/** Cordis plugin name used by loader diagnostics. */
export const name = 'svgframe-dsh-plugin';

/** The only host service this plugin needs. */
export const inject = ['tools'];

const PREFIX = '[svgframe-dsh]';
const localRequire = createRequire(import.meta.url);

/**
 * Resolve `defineTool` from the running DSH installation. A bundled profile
 * does not put `@deepseek-ai/dsh-tools` on this package's resolution path, so
 * we first try normal resolution and then the verified installation anchor.
 *
 * @returns {(definition: object) => object}
 */
function loadDefineTool() {
  const candidates = ['@deepseek-ai/dsh-tools'];
  if (process.env.DSH_INSTALL_DIR) candidates.push(process.env.DSH_INSTALL_DIR);
  for (const from of candidates) {
    try {
      const resolved = from.startsWith('@')
        ? localRequire.resolve(from)
        : localRequire.resolve('@deepseek-ai/dsh-tools', { paths: [from] });
      const module = localRequire(resolved);
      if (typeof module.defineTool === 'function') return module.defineTool;
    } catch {
      // Try the next anchor; a plain definition still registers.
    }
  }
  return (definition) => definition;
}

/**
 * @param {object} ctx      Cordis context provided by the DSH host.
 * @param {object} config   Row config from the bundle patch.
 * @param {boolean} [config.log]
 * @param {string} [config.dshVersion]
 */
export function apply(ctx, config = {}) {
  const log = config.log === true ? (message) => console.log(`${PREFIX} ${message}`) : () => {};
  const defineTool = loadDefineTool();
  log(`apply start (defineTool=${defineTool.name || 'fallback'})`);

  ctx.effect(() => {
    const tool = defineTool({
      name: 'svgframe_probe',
      description:
        'Report the pinned DSH plugin identity and the editor session view. Read-only diagnostic tool.',
      parameters: {
        sessionId: { type: 'string', description: 'Optional session id to echo back.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            plugin: { type: 'string', required: true },
            dshVersion: { type: 'string', required: true },
            sessionId: { type: 'string', required: true },
            rootId: { type: 'string', required: true },
            elementCount: { type: 'integer', required: true },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: `${value.plugin} on dsh ${value.dshVersion}: ${value.rootId} (${value.elementCount} elements)`,
          },
        ],
      },
      async execute(args, exec) {
        exec?.signal?.throwIfAborted();
        const session = createFakeEditorSession();
        try {
          const document = await session.inspectDocument({ signal: exec?.signal });
          return {
            plugin: name,
            dshVersion: config.dshVersion ?? 'unknown',
            sessionId: args.sessionId ?? session.id,
            rootId: document.rootId,
            elementCount: document.elementCount,
          };
        } finally {
          await session.close();
        }
      },
    });

    const unregister = ctx.tools.register(tool);
    const toolName = tool.name;
    log(
      `registered ${toolName}; registry=${ctx.tools.get(toolName) === undefined ? 'miss' : 'hit'}`,
    );

    return () => {
      unregister?.();
      const residue = ctx.tools.get(toolName) === undefined;
      log(`disposed ${toolName}; registry-free=${residue}`);
    };
  });
}
