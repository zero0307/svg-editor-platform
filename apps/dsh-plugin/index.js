import { createFakeEditorSession } from './editor-session-port.js';

export const name = 'svgframe-dsh-plugin';
export const inject = ['tools'];

export function apply(ctx, config = {}) {
  const probe = {
    name: 'svgframe_probe',
    description: 'Inspect the minimal editor session used by the DSH lifecycle check.',
    parameters: { sessionId: { type: 'string', description: 'Optional session identifier.' } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plugin: { type: 'string' },
          dshVersion: { type: 'string' },
          sessionId: { type: 'string' },
          rootId: { type: 'string' },
          elementCount: { type: 'integer' },
        },
        required: ['plugin', 'dshVersion', 'sessionId', 'rootId', 'elementCount'],
      },
      render: (_args, value) => [
        { type: 'text', text: value.plugin + ' (' + value.dshVersion + ')' },
      ],
    },
    async execute(args, exec) {
      exec?.signal?.throwIfAborted();
      const session = createFakeEditorSession();
      try {
        const view = await session.inspectDocument({ signal: exec?.signal });
        return {
          plugin: name,
          dshVersion: config.dshVersion ?? 'unknown',
          sessionId: args.sessionId ?? session.id,
          rootId: view.rootId,
          elementCount: view.elementCount,
        };
      } finally {
        await session.close();
      }
    },
  };
  ctx.effect(() => {
    const unregister = ctx.tools.register(probe);
    if (config.log) console.log('registered ' + probe.name);
    return () => {
      unregister?.();
      if (config.log) console.log('disposed ' + probe.name);
    };
  });
}
