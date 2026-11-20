import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutFlowchart } from '../src/layoutFlowchart.js';
import type { Chart, GraphEdge } from '../src/flowchart.js';
import { fixture } from './fixture.js';

test('mixed scripts, empty lines and edits to visible wrapped text round-trip exactly', async () => {
  const { tools, session, files } = fixture();
  const label =
    '审查隐私条款与数据保留范围'.repeat(4) +
    ' 👨‍👩‍👧‍👦 ' +
    'e\u0301'.repeat(40) +
    ' & <导出>\r\n\n\tQA\rEND';
  const graph = {
    nodes: [
      { id: 'long', label },
      { id: 'long-label-2', label: '通过' },
    ],
    edges: [],
  };
  const layout = layoutFlowchart(graph);
  assert.ok(layout.nodes[0]!.width <= 200);
  assert.ok(layout.nodes[0]!.height > layout.nodes[1]!.height);
  assert.equal(layout.nodes[1]!.width, 108);
  const path = 'mixed.svg';
  await tools.createFlowchart({ ...layout, path });
  const view = await tools.inspect(path);
  assert.deepEqual(view.graph.nodes, graph.nodes);
  assert.deepEqual(view.warnings, []);
  assert.equal(new Set(view.structure.map((s) => s.id)).size, view.structure.length);
  const { document } = await session().read(path);
  const lines = document.children[0]!.children.filter((s) => s.kind === 'text');
  assert.ok(lines.length > 4);
  const boundaries = new Set(
    Array.from(
      new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(label),
      (s) => s.index,
    ),
  );
  boundaries.add(label.length);
  let offset = 0;
  for (const line of lines) {
    const before = line.attributes['data-dsh-break'];
    offset += before === 'crlf' ? 2 : before === 'lf' || before === 'cr' ? 1 : 0;
    assert.ok(boundaries.has(offset));
    offset += (line.text ?? '').length;
    assert.ok(boundaries.has(offset));
  }
  assert.equal(offset, label.length);
  files.set(path, files.get(path)!.replace('>END</text>', '>终审</text>'));
  assert.equal((await tools.inspect(path)).graph.nodes[0]!.label, label.replace('END', '终审'));
});

function luminance(color: string) {
  const [red, green, blue] = [1, 3, 5].map((i) => {
    const value = parseInt(color.slice(i, i + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}

test('rendered text in both themes has at least 4.5:1 contrast for all five topology roles', async () => {
  const { tools, session, files } = fixture();
  const nodes = ['start', 'branch', 'first', 'second', 'join', 'end'].map((id) => ({
    id,
    label: id,
  }));
  const edges = [
    ['start', 'branch'],
    ['branch', 'first'],
    ['branch', 'second'],
    ['first', 'join'],
    ['second', 'join'],
    ['join', 'end'],
  ].map(([from, to], i) => ({ id: 'e' + i, from: from!, to: to! }));
  const layout = layoutFlowchart({ nodes, edges });
  for (const theme of ['studio', 'print'] as const) {
    const path = theme + '.svg';
    await tools.createFlowchart({ ...layout, path, theme });
    const { document, warnings } = await session().read(path);
    assert.deepEqual(warnings, []);
    const fills = new Set<string>();
    for (const { id } of nodes) {
      const shapes = document.children.find((s) => s.id === id)!.children;
      const rect = shapes.find((s) => s.kind === 'rect')!.attributes;
      const text = shapes.find((s) => s.kind === 'text')!.attributes;
      const [light, dark] = [luminance(rect.fill!), luminance(text.fill!)].sort((a, b) => b - a);
      assert.ok((light! + 0.05) / (dark! + 0.05) >= 4.5, theme + ' ' + id);
      assert.ok(Number(rect.rx) > 0);
      assert.equal(text['text-anchor'], 'middle');
      if (theme === 'print')
        for (const color of [rect.fill!, rect.stroke!, text.fill!])
          assert.match(color, /^#([0-9A-F]{2})\1\1$/i);
      fills.add(rect.fill!);
    }
    if (theme === 'studio') assert.equal(fills.size, 5);
    assert.deepEqual((await tools.inspect(path)).graph, {
      nodes,
      edges,
      inferredEdges: [],
      unresolvedEdges: [],
    });
  }
  const prior = files.get('studio.svg');
  await assert.rejects(
    tools.createFlowchart({ ...layout, path: 'studio.svg', theme: 'unknown' as Chart['theme'] }),
    /theme/,
  );
  assert.equal(files.get('studio.svg'), prior);
});

test('routes through four alternating openings in both directions, and rejects a closed passage', async () => {
  const { tools, session, files } = fixture();
  const walls = Array.from({ length: 4 }, (_, i) => ({
    id: 'w' + i,
    label: '墙',
    x: 100 + i * 112,
    y: i % 2 ? 65 : 0,
    width: 44,
    height: 155,
  }));
  const nodes = [
    { id: 'a', label: 'A', x: 10, y: 92, width: 36, height: 36 },
    { id: 'z', label: 'Z', x: 552, y: 92, width: 36, height: 36 },
    ...walls,
  ];
  for (const [from, to] of [
    ['a', 'z'],
    ['z', 'a'],
  ] as const) {
    const edge = { id: 'route', from, to };
    const chart = { width: 600, height: 220, nodes, edges: [edge], path: from + '.svg' };
    await tools.createFlowchart(chart);
    const { document } = await session().read(chart.path);
    const segments = document.children
      .find((s) => s.id === 'route')!
      .children.filter((s) => s.attributes['data-dsh-part'] === 'route');
    const openings = new Set<string>();
    for (const { attributes } of segments) {
      const { x1, y1, x2, y2 } = attributes;
      const left = Math.min(+x1!, +x2!),
        right = Math.max(+x1!, +x2!),
        top = Math.min(+y1!, +y2!),
        bottom = Math.max(+y1!, +y2!);
      assert.ok(left === right || top === bottom);
      for (const wall of walls) {
        assert.ok(
          right <= wall.x - 4 ||
            left >= wall.x + wall.width + 4 ||
            bottom <= wall.y - 4 ||
            top >= wall.y + wall.height + 4,
        );
        const center = wall.x + wall.width / 2;
        if (left <= center && center <= right) openings.add(wall.id);
      }
    }
    assert.equal(openings.size, 4);
    const view = await tools.inspect(chart.path);
    assert.deepEqual(view.graph.edges, [edge]);
    assert.deepEqual([view.warnings, view.graph.unresolvedEdges], [[], []]);
    const prior = files.get(chart.path);
    await assert.rejects(
      tools.createFlowchart({
        ...chart,
        nodes: [...nodes.slice(0, 2), { ...walls[0]!, height: 220 }],
      }),
      /No clear connector/,
    );
    assert.equal(files.get(chart.path), prior);
  }
});

test('64 nodes and 448 directed connections survive layout, file generation and inspection', async () => {
  const { tools } = fixture();
  const nodes = Array.from({ length: 64 }, (_, i) => ({ id: 'n' + i, label: '工序 ' + i }));
  const edges: GraphEdge[] = [];
  for (let i = 0; i < 56; i++)
    for (let row = 0; row < 8; row++) {
      const to = (Math.floor(i / 8) + 1) * 8 + row;
      edges.push({ id: 'e' + i + '-' + to, from: 'n' + i, to: 'n' + to });
    }
  const graph = { nodes, edges };
  assert.equal(edges.length, 448);
  const path = 'dense.svg';
  await tools.createFlowchart({ ...layoutFlowchart(graph), path });
  const result = await tools.inspect(path);
  assert.deepEqual(result.graph, { ...graph, inferredEdges: [], unresolvedEdges: [] });
  assert.deepEqual(result.warnings, []);
});
