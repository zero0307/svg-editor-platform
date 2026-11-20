import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Chart, ChartNode } from '../src/flowchart.js';
import { wrapLabel } from '../src/chartText.js';
import { layoutFlowchart } from '../src/layoutFlowchart.js';
import { Phase1EditorSession, quadraticPoints } from '../src/session.cjs';
import { fixture } from './fixture.js';

const nodes = [
  { id: 'a', label: 'A', x: 10, y: 75, width: 48, height: 34 },
  { id: 'b', label: 'B', x: 260, y: 75, width: 48, height: 34 },
];
const edges = [{ id: 'link', from: 'a', to: 'b' }];
const chart: Chart = {
  width: 320,
  height: 185,
  nodes,
  edges,
  path: 'arc.svg',
  connectorStyle: 'arc',
};

test('native quadratic survives import and transforms; arrow verification uses its visible tangent', async () => {
  const { tools, files, session } = fixture();
  await tools.createFlowchart(chart);
  const original = files.get(chart.path)!;
  assert.match(original, /<path [^>]*fill="none"/);
  const { document } = await session().read(chart.path);
  const path = document.children[0]!.children.find((s) => s.kind === 'path')!;
  const { x1, y1, cx, cy, x2, y2 } = quadraticPoints(path.attributes.d!);
  assert.equal(y1, y2);
  assert.ok(Math.abs(cy - y1) > 10);
  assert.deepEqual((await tools.inspect(chart.path)).graph.edges, edges);
  for (const edited of [
    original.replace(/<line [^>]*data-dsh-part="arrow"[^>]*\/>/, ''),
    original.replace(path.attributes.d!, `M ${x1 + 2} ${y1} Q ${cx} ${cy} ${x2} ${y2}`),
    original.replace(
      path.attributes.d!,
      `M ${x1} ${y1} Q ${2 * x2 - cx} ${2 * y2 - cy} ${x2} ${y2}`,
    ),
  ]) {
    files.set(chart.path, edited);
    const view = await tools.inspect(chart.path);
    assert.deepEqual(view.graph.edges, []);
    assert.deepEqual(view.graph.unresolvedEdges, ['link']);
  }
  files.set(
    'scaled.svg',
    '<svg><g id="g" transform="translate(3 4) scale(2)"><path id="q" d="M0,0 Q 10,20 30,0"/></g></svg>',
  );
  const projected = (await session().read('scaled.svg')).document.children[0]!.children[0]!;
  assert.deepEqual(quadraticPoints(projected.attributes.d!), {
    x1: 3,
    y1: 4,
    cx: 23,
    cy: 44,
    x2: 63,
    y2: 4,
  });
  assert.equal(projected.attributes.fill, undefined);
  const legacy = new Phase1EditorSession({ read: async () => original, write: async () => {} });
  await assert.rejects(legacy.read('arc.svg'), /unknown shape type: path/);
});

test('a tight corridor falls back to its clear route; invalid styling never publishes', async () => {
  const { tools, files, session } = fixture();
  const walls: ChartNode[] = [
    { id: 'upper', label: 'upper', x: 75, y: 0, width: 168, height: 85 },
    { id: 'lower', label: 'lower', x: 75, y: 99, width: 168, height: 86 },
  ];
  await tools.createFlowchart({ ...chart, nodes: [...nodes, ...walls] });
  const { document } = await session().read(chart.path);
  assert.equal(document.children[0]!.children.filter((s) => s.kind === 'path').length, 0);
  assert.deepEqual((await tools.inspect(chart.path)).graph.edges, edges);
  const before = files.get(chart.path);
  for (const edgeStyles of [
    [{ ids: ['unknown'], style: 'arc' as const }],
    [{ ids: ['link', 'link'], tone: 'accent' as const }],
  ]) {
    await assert.rejects(tools.createFlowchart({ ...chart, edgeStyles }), /styled edge/);
    assert.equal(files.get(chart.path), before);
  }
});

test('both themes preserve the five residuals, memory and query, and curves avoid other nodes', async () => {
  const input: Chart = JSON.parse(
    await readFile(new URL('../../demo/transformer-reference.json', import.meta.url), 'utf8'),
  );
  const incoming = Object.fromEntries(input.edges.map((e) => [e.id, [e.from, e.to]]));
  for (const [source, target] of [
    ['src-add', 'enc-norm1'],
    ['enc-norm1', 'enc-norm2'],
    ['tgt-add', 'dec-norm1'],
    ['dec-norm1', 'dec-norm2'],
    ['dec-norm2', 'dec-norm3'],
  ])
    assert.deepEqual(incoming['residual-' + target], [source, target]);
  assert.deepEqual(incoming['enc-norm2--dec-cross'], ['enc-norm2', 'dec-cross']);
  assert.deepEqual(incoming['dec-norm1--dec-cross'], ['dec-norm1', 'dec-cross']);
  const { tools, session } = fixture();
  for (const theme of ['studio', 'print'] as const) {
    await tools.createFlowchart({ ...input, path: 'test.svg', theme });
    const result = await tools.inspect('test.svg');
    assert.deepEqual(result.graph.edges, input.edges);
    assert.deepEqual([result.graph.unresolvedEdges, result.warnings], [[], []]);
    const groups = (await session().read('test.svg')).document.children;
    let curves = 0;
    for (const edge of input.edges) {
      const pieces = groups.find((s) => s.id === edge.id)!.children;
      for (const s of pieces.filter((s) => s.kind === 'path')) {
        curves++;
        if (edge.id.startsWith('residual-')) assert.equal(s.attributes['stroke-dasharray'], '5 4');
        const d = quadraticPoints(s.attributes.d!);
        for (let i = 0; i <= 100; i++) {
          const t = i / 100,
            u = 1 - t;
          const x = u * u * d.x1 + 2 * u * t * d.cx + t * t * d.x2,
            y = u * u * d.y1 + 2 * u * t * d.cy + t * t * d.y2;
          assert.ok(x >= 0 && y >= 0 && x <= input.width && y <= input.height);
          for (const n of input.nodes.filter((n) => n.id !== edge.from && n.id !== edge.to))
            assert.ok(
              x <= n.x - 4 || x >= n.x + n.width + 4 || y <= n.y - 4 || y >= n.y + n.height + 4,
              edge.id + ' crosses ' + n.id,
            );
        }
      }
    }
    assert.ok(curves >= 6);
  }
});

test('automatic business workflow can select curves using the same create and inspect tools', async () => {
  const demo = JSON.parse(
    await readFile(new URL('../../demo/release-curves.json', import.meta.url), 'utf8'),
  );
  const { tools, session } = fixture();
  await tools.createFlowchart({ ...demo, ...layoutFlowchart(demo), path: 'release.svg' });
  const view = await tools.inspect('release.svg');
  assert.deepEqual(view.graph, {
    nodes: demo.nodes,
    edges: demo.edges,
    inferredEdges: [],
    unresolvedEdges: [],
  });
  assert.ok(view.counts.path! >= 2);
  const group = (await session().read('release.svg')).document.children.find((s) => s.id === 'e3')!;
  assert.equal(group.children.find((s) => s.kind === 'path')!.attributes.stroke, '#08766F');
});

test('soft wrapping keeps closing punctuation with its preceding Chinese grapheme', () => {
  const label = '审'.repeat(10) + '。';
  const lines = wrapLabel(label);
  assert.deepEqual(
    lines.map((l) => l.text),
    ['审'.repeat(9), '审。'],
  );
  assert.equal(lines.map((l) => l.text).join(''), label);
});

test('diagonal connectors terminate on the ellipse contour and moved endpoints become unresolved', async () => {
  const { tools, files, session } = fixture();
  const oval: ChartNode = { ...nodes[0]!, shape: 'ellipse', width: 86, height: 44 };
  await tools.createFlowchart({
    ...chart,
    connectorStyle: 'angular',
    nodes: [oval, { ...nodes[1]!, y: 12 }],
  });
  const result = await tools.inspect(chart.path);
  assert.deepEqual(result.graph.edges, edges);
  const route = (await session().read(chart.path)).document.children[0]!.children[0]!;
  const { x1, y1 } = route.attributes;
  assert.ok(
    Math.abs(((Number(x1) - oval.x - 43) / 43) ** 2 + ((Number(y1) - oval.y - 22) / 22) ** 2 - 1) <
      1e-6,
  );
  files.set(chart.path, files.get(chart.path)!.replace('x1="' + x1 + '"', 'x1="' + oval.x + '"'));
  assert.deepEqual((await tools.inspect(chart.path)).graph.unresolvedEdges, ['link']);
});

test('import preflight preserves global ID uniqueness across anonymous and nested shapes', async () => {
  const { files, session } = fixture();
  const reader = session();
  files.set(
    'ok.svg',
    '<svg><g><rect width="3" height="4"/><g id="nested"><rect id="rect1" width="1" height="1"/></g></g></svg>',
  );
  assert.ok((await reader.read('ok.svg')).warnings.some((w) => w.includes('rect2')));
  const before = reader.snapshot();
  files.set('duplicate.svg', '<svg><g id="outer"><g id="duplicate"/></g><g id="duplicate"/></svg>');
  await assert.rejects(reader.read('duplicate.svg'), /already exists/);
  assert.deepEqual(reader.snapshot(), before);
});
