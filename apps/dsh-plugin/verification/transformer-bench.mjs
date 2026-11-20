import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { 'package-dir': { type: 'string' }, 'export-layers': { type: 'string' } },
});
const runtime = values['package-dir']
  ? pathToFileURL(resolve(values['package-dir'], 'dist/src') + '/')
  : new URL('../dist/src/', import.meta.url);
const { SvgTools } = await import(new URL('SvgTools.js', runtime));
const { Phase1EditorSession } = await import(new URL('session.cjs', runtime));
const { layoutFlowchart } = await import(new URL('layoutFlowchart.js', runtime));
const overview = JSON.parse(
  await readFile(new URL('../demo/transformer.json', import.meta.url), 'utf8'),
);
// Unroll both stacks. Every decoder layer receives the same final encoder memory.
function unroll(layers) {
  const nodes = [],
    edges = [];
  const stack = (id) => (id.startsWith('enc-') ? 'enc' : id.startsWith('dec-') ? 'dec' : undefined);
  const at = (id, i) => (stack(id) ? id + '-' + i : id);
  for (const { id, label } of overview.nodes) {
    const repeats = stack(id) ? layers : 1;
    for (let i = 1; i <= repeats; i++) nodes.push({ id: at(id, i), label });
  }
  for (const { from, to } of overview.edges) {
    const count = stack(to) ? layers : 1;
    for (let i = 1; i <= count; i++) {
      let source = at(from, stack(to) ? i : layers);
      if (i > 1 && from === 'src-embed') source = at('enc-norm2', i - 1);
      if (i > 1 && from === 'tgt-embed') source = at('dec-norm3', i - 1);
      const target = at(to, i);
      edges.push({ id: source + '--' + target, from: source, to: target });
    }
  }
  assert.equal(edges.filter((e) => e.from === 'memory').length, layers);
  return { nodes, edges };
}

async function measure(graph) {
  let svg;
  const tools = new SvgTools(
    () =>
      new Phase1EditorSession({
        read: async () => svg,
        write: async (_p, data) => {
          svg = data;
        },
      }),
  );
  const start = performance.now();
  const layout = layoutFlowchart(graph);
  const laidOut = performance.now();
  await tools.createFlowchart({ ...layout, path: 'stress.svg' });
  const written = performance.now();
  const view = await tools.inspect('stress.svg');
  const inspected = performance.now();
  assert.deepEqual(view.graph, { ...graph, inferredEdges: [], unresolvedEdges: [] });
  assert.deepEqual(view.warnings, []);
  return {
    layout: laidOut - start,
    generate: written - laidOut,
    inspect: inspected - written,
    bytes: Buffer.byteLength(svg),
    graphSha256: createHash('sha256').update(JSON.stringify(view.graph)).digest('hex'),
  };
}
if (values['export-layers'] !== undefined) {
  const layers = Number(values['export-layers']);
  assert.ok([1, 6, 12, 24].includes(layers), 'Choose 1, 6, 12 or 24 layers per stack.');
  console.log(JSON.stringify(unroll(layers)));
  process.exit(0);
}
const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const runs = [];
for (const layers of [1, 6, 12, 24]) {
  const graph = unroll(layers);
  await measure(graph);
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push(await measure(graph));
  const medianMs = {};
  for (const stage of ['layout', 'generate', 'inspect'])
    medianMs[stage] = Number(median(samples.map((s) => s[stage])).toFixed(2));
  runs.push({
    layers,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    bytes: samples[0].bytes,
    graphSha256: samples[0].graphSha256,
    medianMs,
  });
}
console.log(
  JSON.stringify(
    { node: process.version, cpu: cpus()[0]?.model, warmupsPerSize: 1, samplesPerSize: 5, runs },
    null,
    2,
  ),
);
