import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { layoutFlowchart } from '../src/layoutFlowchart.js';
import { fixture } from './fixture.js';

test('named ports survive layout, generation and read-back in all four directions', async () => {
  const { tools } = fixture();
  const graph = {
    nodes: [
      { id: 'source', label: 'A' },
      { id: 'sink', label: 'B' },
    ],
    edges: [{ id: 'inputs', from: 'source', to: 'sink', inputs: ['CLK', 'EN', 'D'] }],
  };
  const layout = layoutFlowchart(graph);
  assert.ok(layout.nodes[1]!.height >= 76);
  const path = 'ports.svg';
  await tools.createFlowchart({ ...layout, path });
  assert.deepEqual((await tools.inspect(path)).graph.edges, graph.edges);
  for (const [x, y] of [
    [150, 20],
    [150, 320],
    [5, 170],
    [320, 170],
  ] as const) {
    const nodes = [
      { ...graph.nodes[0]!, x, y, width: 80, height: 70 },
      { ...graph.nodes[1]!, x: 135, y: 160, width: 110, height: 90 },
    ];
    await tools.createFlowchart({ width: 450, height: 440, nodes, edges: graph.edges, path });
    const result = await tools.inspect(path);
    assert.deepEqual(result.graph.edges, graph.edges);
    assert.deepEqual(result.graph.unresolvedEdges, []);
  }
});

test('tampered forks are unresolved and impossible placements never replace the file', async () => {
  const { tools, files } = fixture();
  const path = 'ports.svg',
    graph = {
      nodes: [
        { id: 'one', label: 'Source' },
        { id: 'two', label: 'Target' },
      ],
      edges: [{ id: 'data', from: 'one', to: 'two', inputs: ['Q', 'K', 'V'] }],
    };
  const layout = layoutFlowchart(graph);
  await tools.createFlowchart({ ...layout, path });
  const original = files.get(path)!;
  for (const damage of [
    'bus',
    'arm',
    'label',
    'arrow',
    'detach',
    'metadata',
    'shift target',
    'move label',
  ]) {
    const doc = new DOMParser().parseFromString(original, 'image/svg+xml');
    const edge = doc.getElementById('data')!;
    const group = doc.getElementById('data-port-K')!;
    if (damage === 'metadata') edge.removeAttribute('data-dsh-inputs');
    if (damage === 'bus')
      Array.from(edge.getElementsByTagName('line'))
        .find((l) => l.getAttribute('data-dsh-part') === 'bus')!
        .setAttribute('y1', '10');
    if (damage === 'arm') edge.removeChild(group);
    if (damage === 'label') group.getElementsByTagName('text')[0]!.textContent = 'Q';
    if (damage === 'arrow') group.removeChild(group.getElementsByTagName('line')[1]!);
    if (damage === 'detach') group.getElementsByTagName('line')[0]!.setAttribute('y1', '20');
    if (damage === 'move label') group.getElementsByTagName('text')[0]!.setAttribute('y', '0');
    if (damage === 'shift target') doc.getElementById('two-rect')!.setAttribute('x', '5');
    files.set(path, doc.toString());
    assert.deepEqual((await tools.inspect(path)).graph.unresolvedEdges, ['data'], damage);
  }
  files.set(path, original);
  for (const inputs of [[], ['A', 'A'], ['bad label']])
    await assert.rejects(
      tools.createFlowchart({ ...layout, path, edges: [{ ...graph.edges[0]!, inputs }] }),
      /input/,
    );
  await assert.rejects(
    tools.createFlowchart({
      ...layout,
      path,
      nodes: layout.nodes.map((n) => ({ ...n, height: 24 })),
    }),
    /more room/,
  );
  assert.equal(files.get(path), original);
});

test('a chain of sixty three-input forks retains every named arrow', async () => {
  const { tools } = fixture();
  const nodes = Array.from({ length: 61 }, (_, i) => ({ id: 'stage-' + i, label: 'Stage ' + i }));
  const edges = nodes.slice(1).map((node, i) => ({
    id: 'link-' + i,
    from: nodes[i]!.id,
    to: node.id,
    inputs: ['Q', 'K', 'V'],
  }));
  const chart = layoutFlowchart({ nodes, edges });
  await tools.createFlowchart({ ...chart, path: 'dense.svg' });
  const view = await tools.inspect('dense.svg');
  assert.deepEqual(view.graph, { nodes, edges, unresolvedEdges: [], inferredEdges: [] });
  assert.equal(view.counts.text, 61 + 180);
  assert.deepEqual(view.warnings, []);
});
