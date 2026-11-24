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
      const names = [
        'svg_check_flowchart',
        'svg_create_flowchart',
        'svg_edit_flowchart',
        'svg_inspect',
        'svg_layout_flowchart',
      ];
      const registered = () =>
        ctx.tools
          .schemas()
          .map((s) => s.name)
          .filter((n) => names.includes(n))
          .sort();
      if (process.env.SVG_CHECK_MODE === 'removed') {
        assert.deepEqual(registered(), []);
        await writeFile(
          process.env.SVG_CHECK_REPORT,
          JSON.stringify({ afterUninstall: registered() }),
        );
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
      const localEdit = await call('svg_edit_flowchart', {
        path,
        output: '局部编辑.svg',
        operation: 'rename',
        nodeId: 'start',
        label: '已核对',
      });
      assert.equal(localEdit.verified, true);
      assert.equal(localEdit.unrelatedNodesMoved, 0);
      assert.match(await readFile(localEdit.preview, 'utf8'), /修改前/);
      const requirements = await call('svg_check_flowchart', {
        path: localEdit.path,
        labels: [{ label: '已核对', minimum: 1 }],
        connections: [{ from: 'start', to: 'end' }],
      });
      assert.equal(requirements.status, 'passed');
      const missing = await call('svg_check_flowchart', {
        path: localEdit.path,
        requiredNodes: ['missing'],
      });
      assert.equal(missing.status, 'failed');
      const forkFile = '具名端口.svg';
      await call('svg_create_flowchart', {
        path: forkFile,
        width: 600,
        height: 250,
        nodes: [
          { id: 'src', label: '来源', x: 30, y: 60, width: 100, height: 80 },
          { id: 'dst', label: '目标', x: 350, y: 60, width: 160, height: 80 },
        ],
        edges: [{ id: 'fork', from: 'src', to: 'dst', inputs: ['K', 'V'] }],
      });
      const completeFork = await readFile(forkFile, 'utf8');
      const brokenFork = completeFork.replace(/<line [^>]*data-dsh-part="arrow"[^>]*\/>/, '');
      assert.notEqual(completeFork, brokenFork);
      await writeFile('坏箭头.svg', brokenFork);
      const damage = await call('svg_check_flowchart', {
        path: '坏箭头.svg',
        markPath: '标记.svg',
        connections: [{ from: 'src', to: 'dst', inputs: ['K', 'V'] }],
      });
      assert.equal(damage.status, 'failed');
      assert.match(damage.problems.join(' '), /incomplete arrow: K/);
      assert.equal(damage.locations.length, 1);
      assert.match(await readFile(damage.marked, 'utf8'), /stroke="#b31936"/);

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
      const directed = await call('svg_inspect', { path: 'directed.svg' });
      assert.deepEqual(directed.graph.edges, [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'b', to: 'c' },
        { id: 'e3', from: 'a', to: 'c' },
      ]);
      assert.deepEqual(
        [directed.warnings, directed.graph.inferredEdges, directed.graph.unresolvedEdges],
        [[], [], []],
      );
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
      const input = JSON.parse(await readFile(process.env.SVG_DEMO_INPUT, 'utf8'));
      const graph = {
        nodes: input.nodes.map(({ id, label }) => ({ id, label })),
        edges: input.edges,
      };
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
      const automatic = await inSession('svg_layout_flowchart', graph);
      // An explicitly positioned architecture diagram uses its supplied positions for publication.
      const layout = input.width === undefined ? { ...input, ...automatic } : input;
      assert.deepEqual(layout.edges, graph.edges);
      assert.deepEqual(
        layout.nodes.map(({ id, label }) => ({ id, label })),
        graph.nodes,
      );
      const demoPath = 'demo.svg';
      const demoCreated = await inSession('svg_create_flowchart', {
        ...layout,
        path: demoPath,
        theme: process.env.SVG_DEMO_THEME,
      });
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
      assert.equal(
        (demoView.counts.rect ?? 0) + (demoView.counts.ellipse ?? 0),
        count + (layout.panels?.length ?? 0),
      );
      assert.ok(demoView.counts.text >= count);
      for (const { id } of graph.nodes) {
        const first = demoView.structure.find((s) => s.id === id + '-label');
        assert.equal(first?.type, 'text');
        assert.equal(first.parent, id);
      }
      const otherTheme = process.env.SVG_DEMO_THEME === 'studio' ? 'print' : 'studio';
      const alternate = 'alternate.svg';
      await inSession('svg_create_flowchart', { ...layout, path: alternate, theme: otherTheme });
      const other = await inSession('svg_inspect', { path: alternate });
      assert.deepEqual(other.graph, demoView.graph);
      assert.deepEqual(other.warnings, []);
      const output = (name) => readFile(pathUtil.join(directory, name), 'utf8');
      assert.notEqual(await output(alternate), await output(demoPath));
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
      await writeFile(
        process.env.SVG_CHECK_REPORT,
        JSON.stringify({
          demo: {
            directory,
            theme: process.env.SVG_DEMO_THEME,
            graph,
            layout,
            created: demoCreated,
            inspected: demoView,
          },
          created,
          inspected,
          directionChecks,
          legacyGraph: legacy.graph,
          priorDirectedGraph: directed.graph,
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
