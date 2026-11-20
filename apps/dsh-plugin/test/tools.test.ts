import { layoutFlowchart } from '../src/layoutFlowchart.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocumentView, FileStore } from '@svgframe/core';
import { FakeEditorSession } from '@svgframe/core/testing';
import type { Chart } from '../src/flowchart.js';
import { SvgTools } from '../src/SvgTools.js';
import { Phase1EditorSession } from '../src/session.cjs';

const chart: Chart = {
  path: 'chart.svg',
  width: 350,
  height: 150,
  nodes: [
    { id: 'a', label: '开始 & <继续>', x: 8, y: 12, width: 80, height: 30 },
    { id: 'b', label: '完成', x: 200, y: 80, width: 90, height: 35 },
  ],
  edges: [{ id: 'edge', from: 'a', to: 'b' }],
};

function fixture() {
  const files = new Map<string, string>();
  const store: FileStore = {
    async read(path) {
      const content = files.get(path);
      if (content === undefined) throw new Error('missing file');
      return content;
    },
    async write(path, content) {
      if (path === 'denied.svg') throw new Error('write denied');
      files.set(path, content);
    },
  };
  return { files, tools: new SvgTools(() => new Phase1EditorSession(store)) };
}

test('tools run against the public session fake without the CLI or a DSH process', async () => {
  const files = new Map<string, DocumentView>();
  const tools = new SvgTools(
    () =>
      new FakeEditorSession(
        (r) => ({
          id: r.id,
          kind: r.type,
          tag: r.type,
          isContainer: r.type === 'g',
          attributes: Object.fromEntries(
            (r.type === 'line'
              ? ['x1', 'y1', 'x2', 'y2']
              : r.type === 'rect'
                ? ['x', 'y', 'width', 'height']
                : []
            ).map((key, i) => [key, r.args[i]!]),
          ),

          text: r.type === 'text' ? r.args[2]! : null,
          children: [],
        }),
        files,
      ),
  );
  assert.deepEqual(await tools.createFlowchart(chart), { path: chart.path, nodes: 2, edges: 1 });
  const view = await tools.inspect(chart.path);
  assert.deepEqual(view.counts, { line: 3, g: 3, rect: 2, text: 2 });
  assert.deepEqual(view.graph.edges, chart.edges);
  assert.deepEqual(
    view.structure.find((s) => s.id === 'a-label'),
    { id: 'a-label', type: 'text', parent: 'a', text: '开始 & <继续>' },
  );
});

test('real codec round-trips Unicode and XML escaping, geometry and warnings', async () => {
  const { files, tools } = fixture();
  await tools.createFlowchart(chart);
  assert.match(files.get(chart.path)!, /开始 &amp; &lt;继续/);
  assert.match(files.get(chart.path)!, /data-dsh-from="a" data-dsh-to="b"/);
  const view = await tools.inspect(chart.path);
  assert.deepEqual([view.width, view.height, view.structure.length], [350, 150, 10]);
  assert.equal(view.structure.find((s) => s.id === 'a-label')?.text, chart.nodes[0]!.label);
  files.set('source.svg', '<svg><rect width="10" height="20"/></svg>');
  assert.deepEqual((await tools.inspect('source.svg')).warnings, [
    'warning: assigned id rect1 to unnamed <rect>',
  ]);
});

test('bad dimensions, duplicate or derived ids, unknown endpoints and self-loops do not publish', async () => {
  const { files, tools } = fixture();
  files.set(chart.path, 'prior content');
  const node = chart.nodes[0]!;
  for (const change of [
    { width: 0 },
    { nodes: [] },
    { nodes: [node, { ...node, id: 'a-label' }] },
    { nodes: [node, node] },
    { nodes: [{ ...node, height: NaN }] },
    { edges: [{ id: 'a-rect', from: 'a', to: 'b' }] },
    { edges: [{ id: 'link', from: 'missing', to: 'b' }] },
    { edges: [{ id: 'loop', from: 'a', to: 'a' }] },
  ]) {
    await assert.rejects(tools.createFlowchart({ ...chart, ...change }));
    assert.equal(files.get(chart.path), 'prior content');
  }
});

test('two concurrent tool calls have independent sessions and recover from IO failures', async () => {
  const { files, tools } = fixture();
  await assert.rejects(tools.createFlowchart({ ...chart, path: 'denied.svg' }), /write denied/);
  await assert.rejects(tools.inspect('absent.svg'), /missing file/);
  files.set('malformed.svg', '<svg><rect>');
  await assert.rejects(tools.inspect('malformed.svg'));
  await Promise.all([
    tools.createFlowchart(chart),
    tools.createFlowchart({ ...chart, path: 'other.svg', nodes: [chart.nodes[1]!], edges: [] }),
  ]);
  assert.equal((await tools.inspect('other.svg')).structure.length, 3);
  assert.equal((await tools.inspect(chart.path)).structure.length, 10);
});

test('readback follows opaque edge IDs in both directions and detects stale endpoints', async () => {
  const { files, tools } = fixture();
  const edges = [
    { id: 'e&1', from: 'a', to: 'b' },
    { id: 'dsh-line-1', from: 'b', to: 'a' },
  ];
  await tools.createFlowchart({ ...chart, edges });
  const graph = (await tools.inspect(chart.path)).graph;
  assert.deepEqual(graph, {
    nodes: chart.nodes.map(({ id, label }) => ({ id, label })),
    edges,
    inferredEdges: [],
    unresolvedEdges: [],
  });
  const original = files.get(chart.path)!;
  for (const target of ['missing', 'a']) {
    files.set('edited.svg', original.replace('data-dsh-to="b"', 'data-dsh-to="' + target + '"'));
    const result = await tools.inspect('edited.svg');
    assert.deepEqual(result.graph.unresolvedEdges, ['e&1']);
    assert.deepEqual(result.graph.edges, [edges[1]]);
  }
  files.set('moved.svg', original.replace('id="a-rect" x="8"', 'id="a-rect" x="80"'));
  assert.deepEqual(
    (await tools.inspect('moved.svg')).graph.unresolvedEdges,
    edges.map((e) => e.id),
  );
});

test('old center-to-center SVGs expose inference; ambiguous and unattached lines stay unresolved', async () => {
  const { files, tools } = fixture();
  const node = (id: string, x: number) =>
    '<g id="' +
    id +
    '"><rect id="' +
    id +
    '-rect" x="' +
    x +
    '" y="0" width="20" height="20"/><text id="' +
    id +
    '-label" x="0" y="0">' +
    id +
    '</text></g>';
  const make = (extra: string) =>
    '<svg><line id="opaque" x1="10" y1="10" x2="50" y2="10"/><line id="loose" x1="90" y1="10" x2="10" y2="10"/>' +
    node('a', 0) +
    node('b', 40) +
    extra +
    '</svg>';
  files.set('old.svg', make(''));
  const { graph } = await tools.inspect('old.svg');
  assert.deepEqual(graph.edges, [{ id: 'opaque', from: 'a', to: 'b' }]);
  assert.deepEqual(graph.inferredEdges, ['opaque']);
  assert.deepEqual(graph.unresolvedEdges, ['loose']);
  files.set('old.svg', make(node('c', 0)));
  const ambiguous = (await tools.inspect('old.svg')).graph;
  assert.deepEqual(ambiguous.edges, []);
  assert.deepEqual(ambiguous.unresolvedEdges, ['opaque', 'loose']);
});

test('seeded round trips retain directed topology across 300 generated DAGs', async () => {
  let seed = 190273;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const { tools } = fixture();
  for (let sample = 0; sample < 300; sample++) {
    const nodes = Array.from({ length: 3 + Math.floor(random() * 16) }, (_, i) => ({
      id: 'n' + i,
      label: i % 3 ? '步骤' + i : '审核数据并确认' + i,
    }));
    const edges = [];
    for (const [i, from] of nodes.entries()) {
      for (const to of nodes.slice(i + 1))
        if (random() < 0.27) edges.push({ id: 'e' + edges.length, from: from.id, to: to.id });
    }
    const path = 'sample-' + sample + '.svg';
    await tools.createFlowchart({ ...layoutFlowchart({ nodes, edges }), path });
    const result = await tools.inspect(path);
    assert.deepEqual(result.graph, { nodes, edges, inferredEdges: [], unresolvedEdges: [] }, path);
    assert.deepEqual(result.warnings, [], path);
  }
});

test('an interrupted multi-segment connector is unresolved; impossible routing never saves', async () => {
  const { tools, files } = fixture();
  const nodes = ['A', 'B', 'C'].map((id) => ({ id, label: id }));
  const edges = [
    { id: 'e1', from: 'A', to: 'B' },
    { id: 'e2', from: 'B', to: 'C' },
    { id: 'e3', from: 'A', to: 'C' },
  ];
  const layout = layoutFlowchart({ nodes, edges });
  await tools.createFlowchart({ ...layout, path: 'before.svg' });
  const xml = files.get('before.svg')!;
  const start = xml.indexOf('<g id="e3"');
  const edited = xml
    .slice(start)
    .replace(
      /(<line [^>]+data-dsh-part="route"[^>]+\/>\s*<line [^>]+x1=")[^"]+/,
      (_match, prefix: string) => prefix + '999',
    );
  assert.notEqual(edited, xml.slice(start));
  files.set('edited.svg', xml.slice(0, start) + edited);
  assert.deepEqual((await tools.inspect('edited.svg')).graph.unresolvedEdges, ['e3']);
  const overlap = layout.nodes.map((n) => ({ ...n, x: 0, y: 0 }));
  await assert.rejects(
    tools.createFlowchart({ ...layout, nodes: overlap, path: 'impossible.svg' }),
    /route/,
  );
  assert.equal(files.has('impossible.svg'), false);
});
