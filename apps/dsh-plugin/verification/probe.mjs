// Independent acceptance driver loaded only into the disposable verification profile.
import assert from 'node:assert/strict';
import pathUtil from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
export const name = 'svg-acceptance-driver';
export const inject = ['tools', 'loader', 'agents', 'workingDirectory'];

export function apply(ctx) {
  setImmediate(async () => {
    try {
      await ctx.loader.await();
      const names = ['svg_create_flowchart', 'svg_inspect', 'svg_layout_flowchart'];
      const registered = () =>
        ctx.tools
          .schemas()
          .map((s) => s.name)
          .filter((n) => names.includes(n))
          .sort();
      if (process.env.SVG_CHECK_MODE === 'removed') {
        assert.deepEqual(registered(), []);
        console.log('SVG_ACCEPTANCE ' + JSON.stringify({ afterUninstall: registered() }));
        process.exit(0);
      }
      assert.deepEqual(registered(), names);
      let callId = 0;
      async function call(name, args, expectError = false, agent) {
        const outcome = await ctx.tools.execute({
          agent,
          calls: [
            { type: 'tool-call', id: String(++callId), name, arguments: JSON.stringify(args) },
          ],
          signal: AbortSignal.timeout(10000),
        });
        const result = outcome.results[0].result;
        assert.equal(result.isError, expectError, JSON.stringify(result));
        return result.value;
      }
      const nodes = [
        { id: 'start', label: '开始 & 检查', x: 10, y: 12, width: 90, height: 40 },
        { id: 'end', label: '结束', x: 170, y: 90, width: 80, height: 40 },
      ];
      const path = '流程图 demo.svg';
      const chart = {
        path,
        width: 320,
        height: 160,
        nodes,
        edges: [{ id: 'link', from: 'start', to: 'end' }],
      };
      const created = await call('svg_create_flowchart', chart);
      assert.deepEqual(created, { path, nodes: 2, edges: 1 });
      const svg = await readFile(path, 'utf8');
      assert.match(svg, /开始 &amp; 检查/);
      const inspected = await call('svg_inspect', { path });
      assert.deepEqual(inspected.counts, { line: 3, g: 3, rect: 2, text: 2 });
      assert.deepEqual(inspected.graph.edges, chart.edges);
      assert.equal(inspected.width, 320);
      assert.equal(inspected.height, 160);
      assert.equal(inspected.structure.find((n) => n.id === 'start-label').text, '开始 & 检查');
      assert.equal(inspected.structure.find((n) => n.id === 'start-label').parent, 'start');
      await call(
        'svg_create_flowchart',
        { ...chart, edges: [{ id: 'bad', from: 'start', to: 'missing' }] },
        true,
      );
      await call('svg_create_flowchart', { ...chart, width: 'invalid' }, true);
      await call('svg_create_flowchart', chart, true);
      assert.equal(await readFile(path, 'utf8'), svg);
      await call('svg_inspect', { path: 'missing.svg' }, true);
      await writeFile(
        'unnamed.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="2"/></svg>',
      );
      const recovered = await call('svg_inspect', { path: 'unnamed.svg' });
      assert.equal(recovered.structure.length, 1);
      assert.equal(recovered.warnings.length, 1);
      const legacy = await call('svg_inspect', { path: 'legacy.svg' });
      assert.deepEqual(legacy.graph.edges, [
        { id: 'start-process', from: 'start', to: 'process' },
        { id: 'process-done', from: 'process', to: 'done' },
      ]);
      assert.deepEqual(legacy.graph.inferredEdges, ['start-process', 'process-done']);
      assert.deepEqual(legacy.graph.unresolvedEdges, []);
      assert.deepEqual(legacy.warnings, []);
      const second = { ...chart, path: 'second.svg', nodes: [nodes[1]], edges: [] };
      const [, firstAgain] = await Promise.all([
        call('svg_create_flowchart', second),
        call('svg_inspect', { path }),
      ]);
      const secondView = await call('svg_inspect', { path: second.path });
      assert.equal(firstAgain.structure.length, 10);
      assert.equal(secondView.structure.length, 3);
      const directory = 'agent-workspace';
      await mkdir(directory);
      const handle = await ctx.agents.create({
        sessionId: 'svg-demo',
        meta: { cwd: process.cwd() },
      });
      await ctx.workingDirectory.set(handle.agent, pathUtil.resolve(directory));
      const inSession = (name, args, expectError = false) =>
        call(name, args, expectError, handle.agent);
      const graph = JSON.parse(await readFile(process.env.SVG_DEMO_INPUT, 'utf8'));
      await inSession(
        'svg_layout_flowchart',
        {
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          edges: [
            { id: 'ab', from: 'a', to: 'b' },
            { id: 'ba', from: 'b', to: 'a' },
          ],
        },
        true,
      );
      const layout = await inSession('svg_layout_flowchart', graph);
      assert.deepEqual(layout.edges, graph.edges);
      assert.deepEqual(
        layout.nodes.map(({ id, label }) => ({ id, label })),
        graph.nodes,
      );
      const demoPath = 'demo.svg';
      const demoCreated = await inSession('svg_create_flowchart', { ...layout, path: demoPath });
      const demoView = await inSession('svg_inspect', { path: demoPath });
      const count = graph.nodes.length;
      assert.deepEqual(demoCreated, { path: demoPath, nodes: count, edges: graph.edges.length });
      assert.deepEqual([demoView.width, demoView.height], [layout.width, layout.height]);
      assert.deepEqual(demoView.warnings, []);
      assert.deepEqual(demoView.graph, {
        nodes: graph.nodes,
        edges: graph.edges,
        unresolvedEdges: [],
        inferredEdges: [],
      });
      assert.equal(demoView.counts.rect, count);
      assert.equal(demoView.counts.text, count);
      for (const { id, label } of graph.nodes) {
        assert.deepEqual(
          demoView.structure.find((s) => s.id === id + '-label'),
          { id: id + '-label', parent: id, text: label, type: 'text' },
        );
      }
      const bypass = {
        nodes: ['A', 'B', 'C'].map((id) => ({ id, label: id })),
        edges: [
          { id: 'e1', from: 'A', to: 'B' },
          { id: 'e2', from: 'B', to: 'C' },
          { id: 'e3', from: 'A', to: 'C' },
        ],
      };
      const positions = await inSession('svg_layout_flowchart', bypass);
      const directionChecks = [];
      for (const reversed of [false, true]) {
        const routePath = reversed ? 'reverse.svg' : 'bypass.svg';
        const desired = positions.edges.map((e) =>
          reversed && e.id === 'e3' ? { ...e, from: e.to, to: e.from } : e,
        );
        await inSession('svg_create_flowchart', { ...positions, path: routePath, edges: desired });
        const readback = await inSession('svg_inspect', { path: routePath });
        assert.deepEqual(readback.graph.edges, desired);
        directionChecks.push({
          path: routePath,
          edge: readback.graph.edges.find((e) => e.id === 'e3'),
          warnings: readback.warnings,
        });
        assert.deepEqual(readback.graph.unresolvedEdges, []);
        assert.deepEqual(readback.warnings, []);
        assert.ok(
          readback.structure.filter((s) => s.parent === 'e3' && s.type === 'line').length >= 5,
        );
      }
      await handle.dispose();
      const entries = [...ctx.loader.entries()];
      const entry = entries.find((e) => e.options.name === 'dsh-svg-editor');
      assert.ok(
        entry?.fiber,
        'Installed plugin fiber missing: ' + entries.map((e) => e.options.name).join(','),
      );
      await entry.fiber.dispose();
      await ctx.loader.await();
      assert.deepEqual(registered(), []);
      console.log(
        'SVG_ACCEPTANCE ' +
          JSON.stringify({
            demo: { directory, graph, layout, created: demoCreated, inspected: demoView },
            created,
            inspected,
            directionChecks,
            legacyGraph: legacy.graph,
            recoveryWarnings: recovered.warnings,
            independentElementCounts: [firstAgain.structure.length, secondView.structure.length],
            checkedFailures: ['missing endpoint', 'schema', 'existing output', 'missing input'],
            afterLiveUnload: registered(),
          }),
      );
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
}
