import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareChart } from '../src/presentationLayout.js';
import { layoutFlowchart } from '../src/layoutFlowchart.js';
import { fixture } from './fixture.js';
import { editFlowchart } from '../src/editFlowchart.js';

const nodes = ['receipt', 'facts', 'copy', 'proof', 'verified', 'accept', 'publish'].map((id) => ({
  id,
  label: id,
}));
const edges = [
  ['receipt', 'facts'],
  ['receipt', 'copy'],
  ['facts', 'verified'],
  ['copy', 'proof'],
  ['verified', 'accept'],
  ['proof', 'accept'],
  ['accept', 'publish'],
].map(([from, to], i) => ({ id: 'edge' + i, from: from!, to: to! }));
const graph = { path: 'example.svg', title: '稿件发布', nodes, edges };
test('automatic arrangement aligns adjacent parallel tracks despite reversed declaration order', async () => {
  const legacy = new Map(layoutFlowchart(graph).nodes.map((n) => [n.id, n]));
  assert.ok(legacy.get('verified')!.y > legacy.get('proof')!.y);
  for (const direction of ['right', 'down'] as const) {
    const chart = prepareChart({ ...graph, direction });
    const map = new Map(chart.nodes.map((n) => [n.id, n]));
    const cross = direction === 'down' ? 'x' : 'y';
    for (const [from, to] of [
      ['facts', 'verified'],
      ['copy', 'proof'],
    ] as const)
      assert.equal(map.get(from)![cross], map.get(to)![cross]);
    assert.deepEqual(
      chart.nodes.map((n) => n.id),
      nodes.map((n) => n.id),
    );
    assert.deepEqual(
      chart.nodes,
      prepareChart({ ...graph, direction, edges: [...edges].reverse() }).nodes,
    );
    const { tools } = fixture();
    await tools.createFlowchart(chart);
    const result = await tools.inspect(chart.path);
    assert.deepEqual(result.graph, { nodes, edges, inferredEdges: [], unresolvedEdges: [] });
    assert.deepEqual(result.warnings, []);
  }
});
test('bilingual labels keep hierarchy after save, full rename and exact line edit', async () => {
  const f = fixture();
  const chart = prepareChart({
    path: 'initial.svg',
    title: '数据质量检查',
    direction: 'down',
    nodes: [
      { id: 'a', label: '校验字段与单位\r\nSchema validation' },
      { id: 'b', label: '导出报告\nExport' },
    ],
    edges: [{ id: 'ab', from: 'a', to: 'b' }],
  });
  await f.tools.createFlowchart(chart);
  const store = {
    read: async (p: string) => f.files.get(p)!,
    write: async (p: string, s: string) => {
      f.files.set(p, s);
    },
  };
  await editFlowchart(store, {
    path: 'initial.svg',
    output: 'renamed.svg',
    operation: 'rename',
    nodeId: 'a',
    label: '审核字段\r\nReview fields',
  });
  for (const file of ['initial.svg', 'renamed.svg']) {
    const { document } = await f.session().read(file);
    const labels = document.children
      .find((n) => n.id === 'a')!
      .children.filter((n) => n.kind === 'text');
    assert.equal(labels.length, 2);
    assert.ok(
      Number(labels[0]!.attributes['font-size']) > Number(labels[1]!.attributes['font-size']),
    );
    assert.equal(labels[1]!.attributes['font-weight'], '400');
    assert.equal(labels[1]!.attributes['data-dsh-break'], 'crlf');
  }
  const edit = await editFlowchart(store, {
    path: 'initial.svg',
    output: 'single.svg',
    operation: 'rename',
    nodeId: 'a',
    labelLine: 2,
    label: 'Check units',
  });
  assert.equal(edit.otherBytesUnchanged, true);
  assert.equal(
    f.files.get('single.svg'),
    f.files.get('initial.svg')!.replace('Schema validation', 'Check units'),
  );
});
test('manual inputs retain coordinates; mixed geometry is diagnosed before output', () => {
  const manual = { path: 'g.svg', ...layoutFlowchart(graph) };
  assert.deepEqual(prepareChart(manual), manual);
  assert.throws(
    () => prepareChart({ ...graph, nodes: [{ ...nodes[0]!, x: 10 }] }),
    /all four coordinates/,
  );
  assert.throws(() => prepareChart({ ...manual, direction: 'down' }), /automatic/);
});

test('parallel lanes across shuffled ranks keep their order in 36 scan-direction cases', async () => {
  let state = 5139;
  let previousInversions = 0;
  function shuffle<T>(rows: T[]) {
    for (let i = rows.length - 1; i > 0; i--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const j = state % (i + 1);
      [rows[i], rows[j]] = [rows[j]!, rows[i]!];
    }
    return rows;
  }
  for (let trial = 0; trial < 36; trial++) {
    const direction = trial % 2 ? 'right' : 'down',
      lanes = 2 + (trial % 4),
      steps = 2 + (trial % 3);
    const ids = Array.from({ length: steps }, (_, s) =>
      Array.from({ length: lanes }, (_, l) => 's' + s + 'l' + l),
    );
    const stageNodes = ids.flatMap((row) => shuffle([...row]).map((id) => ({ id, label: id })));
    const source = { id: 'source', label: '开始' },
      target = { id: 'end', label: '完成' };
    const edges = ids
      .flatMap((row, i) =>
        row.map((to, j) => ({ id: 'to-' + to, to, from: i ? ids[i - 1]![j]! : source.id })),
      )
      .concat(ids.at(-1)!.map((from) => ({ id: from + '-end', from, to: target.id })));
    const graph = { path: 'test.svg', nodes: [source, ...stageNodes, target], edges };
    const chart = prepareChart({ ...graph, direction }),
      old = layoutFlowchart(graph);
    const oldMap = new Map(old.nodes.map((n) => [n.id, n])),
      map = new Map(chart.nodes.map((n) => [n.id, n]));
    const cross = direction === 'right' ? 'y' : 'x';
    for (let i = 1; i < steps; i++)
      for (let j = 0; j < lanes; j++) {
        const prev = ids[i - 1]!,
          next = ids[i]!;
        assert.equal(map.get(prev[j]!)![cross], map.get(next[j]!)![cross]);
        for (let k = j + 1; k < lanes; k++)
          if (
            (oldMap.get(prev[j]!)!.y - oldMap.get(prev[k]!)!.y) *
              (oldMap.get(next[j]!)!.y - oldMap.get(next[k]!)!.y) <
            0
          )
            previousInversions++;
      }
    const { tools } = fixture();
    await tools.createFlowchart(chart);
    const result = await tools.inspect(chart.path);
    assert.deepEqual(result.graph, {
      nodes: graph.nodes,
      edges,
      inferredEdges: [],
      unresolvedEdges: [],
    });
    assert.deepEqual(result.warnings, []);
  }
  assert.ok(previousInversions > 0);
});

test('automatic layout keeps independently sourced Q and K/V labels clear in both directions', async () => {
  for (const direction of ['right', 'down'] as const) {
    for (const reversed of [false, true]) {
      const nodes = [
        { id: 'decoder', label: '解码器状态' },
        { id: 'memory', label: '编码器记忆' },
        { id: 'cross', label: '交叉注意力', tone: 'accent' as const },
        { id: 'context', label: '上下文表示' },
      ];
      if (reversed) nodes.reverse();
      const edges = [
        { id: 'q', from: 'decoder', to: 'cross', inputs: ['Q'] },
        { id: 'kv', from: 'memory', to: 'cross', inputs: ['K', 'V'] },
        { id: 'out', from: 'cross', to: 'context' },
      ];
      const chart = prepareChart({
        path: 'ports.svg',
        title: '交叉注意力',
        connectorStyle: 'angular',
        direction,
        nodes,
        edges,
      });
      const { tools } = fixture();
      await tools.createFlowchart(chart);
      const result = await tools.inspect(chart.path);
      assert.deepEqual(result.graph.edges, edges);
      assert.deepEqual(result.graph.unresolvedEdges, []);
      assert.deepEqual(result.warnings, []);
    }
  }
});

test('adjacent horizontal ranks keep lane centres when one card has a multiline label', () => {
  const chart = prepareChart({
    ...graph,
    direction: 'right',
    nodes: nodes.map((n) =>
      n.id === 'proof' ? { ...n, label: '校样确认\nProofreading\n第三行' } : n,
    ),
  });
  const centre = (id: string) => {
    const n = chart.nodes.find((n) => n.id === id)!;
    return n.y + n.height / 2;
  };
  assert.equal(centre('copy'), centre('proof'));
  assert.equal(centre('facts'), centre('verified'));
});

test('compact vertical diagrams keep their reading order on a 16:9 slide and also support content bounds', async () => {
  const chart = prepareChart({ ...graph, title: '稿件发布', direction: 'down' });
  assert.equal(chart.width * 9, chart.height * 16);
  assert.ok(chart.slideTitleWidth && chart.nodes.every((n) => n.x >= chart.slideTitleWidth!));
  const compact = prepareChart({ ...graph, direction: 'down', format: 'content' });
  assert.ok(compact.width < chart.width);
  const { tools } = fixture();
  await tools.createFlowchart(chart);
  const saved = await tools.inspect(chart.path);
  assert.deepEqual(saved.graph.nodes, nodes);
  assert.deepEqual(saved.warnings, []);
});
