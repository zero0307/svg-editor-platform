import assert from 'node:assert/strict';
import { test } from 'node:test';

import { apply } from '../index.js';

/** Minimal fake of the DSH tool registry and effect scope. */
function createFakeContext() {
  const registered = new Map();
  const disposers = [];
  return {
    registered,
    tools: {
      register(tool) {
        registered.set(tool.name, tool);
        return () => registered.delete(tool.name);
      },
      get(toolName) {
        return registered.get(toolName);
      },
    },
    effect(callback) {
      const disposer = callback();
      disposers.push(disposer);
      return disposer;
    },
    disposeAll() {
      for (const disposer of disposers.reverse()) disposer?.();
      disposers.length = 0;
    },
  };
}

test('apply registers a structured read-only tool', () => {
  const ctx = createFakeContext();
  apply(ctx, { dshVersion: '0.2.2-rc.5' });

  const tool = ctx.registered.get('svgframe_probe');
  assert.ok(tool, 'svgframe_probe must be registered');
  assert.equal(typeof tool.execute, 'function');
  assert.deepEqual(Object.keys(tool.parameters), ['sessionId']);
  assert.equal(tool.output.schema.properties.elementCount.type, 'integer');
});

test('tool result follows the declared output schema and uses the port fake', async () => {
  const ctx = createFakeContext();
  apply(ctx, { dshVersion: '0.2.2-rc.5' });
  const tool = ctx.registered.get('svgframe_probe');

  const value = await tool.execute({ sessionId: 'unit' });
  assert.deepEqual(value, {
    plugin: 'svgframe-dsh-plugin',
    dshVersion: '0.2.2-rc.5',
    sessionId: 'unit',
    rootId: 'svg-root',
    elementCount: 3,
  });

  const content = tool.output.render({}, value);
  assert.equal(content[0].type, 'text');
  assert.match(content[0].text, /0\.2\.2-rc\.5/);
});

test('disposing the effect releases the registration without residue', () => {
  const ctx = createFakeContext();
  apply(ctx, { log: false });
  assert.ok(ctx.registered.has('svgframe_probe'));

  ctx.disposeAll();
  assert.equal(ctx.registered.has('svgframe_probe'), false);
});

test('cancelled execution stops before touching the port', async () => {
  const ctx = createFakeContext();
  apply(ctx, {});
  const tool = ctx.registered.get('svgframe_probe');
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(() => tool.execute({}, { signal: controller.signal }));
});
