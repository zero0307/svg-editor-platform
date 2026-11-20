import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Chart } from '../src/flowchart.js';
import { fixture } from './fixture.js';

test('Transformer overview keeps its five shortcuts, shared memory and separate residual ports', async () => {
  const chart: Chart = JSON.parse(
    await readFile(new URL('../../demo/transformer.json', import.meta.url), 'utf8'),
  );
  chart.path = 'Transformer.svg';
  const { tools, session } = fixture();
  await tools.createFlowchart(chart);
  const view = await tools.inspect(chart.path);
  const nodes = chart.nodes.map(({ id, label }) => ({ id, label }));
  assert.deepEqual(view.graph, {
    nodes,
    edges: chart.edges,
    inferredEdges: [],
    unresolvedEdges: [],
  });
  assert.deepEqual(view.warnings, []);
  assert.equal(nodes.length, 18);
  assert.equal(chart.edges.length, 22);
  assert.equal(chart.edges.filter((e) => e.id.startsWith('residual-')).length, 5);
  assert.ok(chart.edges.some((e) => e.from === 'memory' && e.to === 'dec-cross'));
  assert.ok(chart.edges.some((e) => e.from === 'dec-query' && e.to === 'dec-cross'));
  assert.equal(view.counts.rect, nodes.length + chart.panels!.length);
  assert.equal(view.structure.find((s) => s.id === 'dsh-title')?.text, chart.title);
  const { document } = await session().read(chart.path);
  function endpoint(edge: string, start: boolean) {
    const lines = document.children
      .find((s) => s.id === edge)!
      .children.filter((s) => s.attributes['data-dsh-part'] === 'route');
    const attrs = (start ? lines[0] : lines.at(-1))!.attributes;
    return start ? [attrs.x1, attrs.y1] : [attrs.x2, attrs.y2];
  }
  for (const [arriving, departing] of [
    ['enc-norm1', 'enc-norm2'],
    ['dec-norm1', 'dec-norm2'],
    ['dec-norm2', 'dec-norm3'],
  ] as const) {
    assert.notDeepEqual(
      endpoint('residual-' + arriving, false),
      endpoint('residual-' + departing, true),
    );
  }
});

test('optional panel dimensions and headings validate before publishing and graphic IDs avoid user IDs', async () => {
  const { tools, files } = fixture();
  const chart: Chart = {
    path: 'panel.svg',
    width: 240,
    height: 200,
    title: 'Example',
    nodes: [{ id: 'dsh-title', label: 'A', x: 40, y: 110, width: 60, height: 40 }],
    edges: [],
    panels: [{ label: 'Stage', x: 10, y: 60, width: 180, height: 120 }],
  };
  await tools.createFlowchart(chart);
  const original = files.get(chart.path);
  const view = await tools.inspect(chart.path);
  assert.deepEqual(view.graph.nodes, [{ id: 'dsh-title', label: 'A' }]);
  assert.equal(new Set(view.structure.map((s) => s.id)).size, view.structure.length);
  for (const panel of [
    { ...chart.panels![0]!, x: -1 },
    { ...chart.panels![0]!, label: 'one\ntwo' },
    { ...chart.panels![0]!, height: 40, description: 'description exceeds the panel' },
  ]) {
    await assert.rejects(tools.createFlowchart({ ...chart, panels: [panel] }));
    assert.equal(files.get(chart.path), original);
  }
});

test('append lookup follows document replacement, failed reads and nested imported IDs', async () => {
  const { session, files } = fixture();
  const writer = session();
  const group = (id: string, parent?: string) => writer.create({ type: 'g', id, args: [] }, parent);
  writer.init(100, 100);
  group('outer');
  group('inner', 'outer');
  writer.create({ type: 'rect', id: 'leaf', args: ['0', '0', '5', '5'] }, 'inner');
  await writer.save('first.svg');
  writer.init(90, 90);
  group('leaf');
  await writer.read('first.svg');
  assert.throws(() => group('leaf'), /already exists/);
  assert.throws(() => group('next', 'leaf'), /not a container/);
  files.set('broken.svg', '<svg>');
  await assert.rejects(writer.read('broken.svg'));
  group('next', 'inner');
  await writer.save('second.svg');
  assert.match(files.get('second.svg')!, /id="next"/);
  writer.init(70, 70);
  assert.throws(() => group('new', 'inner'), /no such container/);
  group('inner');
});

test('a connector through a preferred caption moves its heading and notes together', async () => {
  const { tools, session, files } = fixture();
  const panel = {
    label: 'Receive',
    description: 'Check input',
    x: 80,
    y: 55,
    width: 250,
    height: 92,
  };
  const chart: Chart = {
    path: 'caption.svg',
    width: 400,
    height: 210,
    panels: [panel],
    nodes: [
      { id: 'a', label: 'A', x: 100, y: 2, width: 40, height: 35 },
      { id: 'b', label: 'B', x: 100, y: 158, width: 40, height: 35 },
    ],
    edges: [],
  };
  async function positions() {
    const { document } = await session().read(chart.path);
    return ['dsh-panel-1-heading', 'dsh-panel-1-note-0'].map(
      (id) => document.children.find((s) => s.id === id)!.attributes,
    );
  }
  await tools.createFlowchart(chart);
  const [original] = await positions();
  assert.equal(Number(original!.x), 96);
  for (const connectorStyle of ['angular', 'rounded', 'arc'] as const) {
    await tools.createFlowchart({
      ...chart,
      connectorStyle,
      edges: [{ id: 'edge', from: 'a', to: 'b' }],
    });
    const [heading, note] = await positions();
    assert.ok(Number(heading!.x) > 160);
    assert.equal(note!.x, heading!.x);
    assert.equal(Number(note!.y) - Number(heading!.y), 22);
  }
  const previous = files.get(chart.path);
  await assert.rejects(
    tools.createFlowchart({
      ...chart,
      nodes: [{ id: 'full', label: 'Full', x: 80, y: 55, width: 250, height: 92 }],
    }),
    /more clear space.*Receive/,
  );
  assert.equal(files.get(chart.path), previous);
});
