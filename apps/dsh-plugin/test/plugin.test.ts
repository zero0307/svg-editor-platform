import assert from 'node:assert/strict';
import { test } from 'node:test';

import { apply, inject, name } from '../src/index.js';
import type { DshPluginContext, DshToolDefinition } from '../src/DshContracts.js';
import { FakeSvgFileGateway } from './FakeSvgFileGateway.js';

/** Minimal fake of the Cordis context surface the plugin uses. */
class FakeDshContext {
  readonly registered = new Map<string, DshToolDefinition>();
  private readonly disposers: (() => void)[] = [];
  readonly tools = {
    register: (tool: DshToolDefinition) => {
      this.registered.set(tool.name, tool);
      return () => this.registered.delete(tool.name);
    },
    get: (toolName: string) => this.registered.get(toolName),
  };
  constructor(readonly fs: FakeSvgFileGateway) {}
  effect(callback: () => () => void): void {
    this.disposers.push(callback());
  }
  disposeAll(): void {
    for (const disposer of this.disposers.reverse()) disposer();
    this.disposers.length = 0;
  }
}

const context = (): { ctx: FakeDshContext; plugin: DshPluginContext } => {
  const ctx = new FakeDshContext(new FakeSvgFileGateway());
  return { ctx, plugin: ctx as unknown as DshPluginContext };
};

test('the plugin declares the official DSH entry points', () => {
  assert.equal(name, 'svgframe-dsh-plugin');
  assert.deepEqual(inject, ['tools', 'fs']);
  assert.equal(typeof apply, 'function');
});

test('apply registers both tools and keeps them until disposal', () => {
  const { ctx, plugin } = context();
  apply(plugin, {});
  assert.deepEqual([...ctx.registered.keys()].sort(), ['svg_create_flowchart', 'svg_inspect']);
});

test('disposal releases both registrations without residue', () => {
  const { ctx, plugin } = context();
  apply(plugin, { log: false });
  ctx.disposeAll();
  assert.equal(ctx.registered.size, 0);
});

test('the registered tools are callable through the same contract', async () => {
  const { ctx, plugin } = context();
  apply(plugin, {});
  ctx.fs.files.set(
    'in.svg',
    '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">\n  <rect id="a" x="0" y="0" width="10" height="10" fill="#fff"/>\n</svg>\n',
  );

  const inspect = ctx.registered.get('svg_inspect');
  const create = ctx.registered.get('svg_create_flowchart');
  assert.ok(inspect && create);

  const inspection = (await inspect.execute({ path: 'in.svg' })) as { elements: number };
  assert.equal(inspection.elements, 1);

  const summary = (await create.execute({
    path: 'out.svg',
    nodes: [{ id: 'n1', label: 'A', x: 10, y: 10 }],
    edges: [],
  })) as { elements: number };
  assert.equal(summary.elements, 2);
  assert.ok(ctx.fs.files.has('out.svg'));
});
