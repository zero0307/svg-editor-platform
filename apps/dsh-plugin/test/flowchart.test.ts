import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DshToolDefinition } from '../src/DshContracts.js';
import { SvgInspector } from '../src/SvgInspector.js';
import { SvgRuntime } from '../src/SvgRuntime.js';
import { createToolDefinitions } from '../src/ToolDefinitions.js';
import { FakeSvgFileGateway } from './FakeSvgFileGateway.js';

const tool = (gateway: FakeSvgFileGateway, name: string): DshToolDefinition => {
  const found = createToolDefinitions(gateway).find((candidate) => candidate.name === name);
  assert.ok(found, `${name} must be defined`);
  return found;
};

const NODES = [
  { id: 'n1', label: 'Start', x: 40, y: 40 },
  { id: 'n2', label: 'End', x: 320, y: 200 },
];
const EDGES = [{ from: 'n1', to: 'n2' }];

test('valid input creates a readable SVG with rect, text and connector', async () => {
  const gateway = new FakeSvgFileGateway();
  const summary = await tool(gateway, 'svg_create_flowchart').execute({
    path: 'flow.svg',
    nodes: NODES,
    edges: EDGES,
  });

  assert.deepEqual(summary, { path: 'flow.svg', nodes: 2, connectors: 1, elements: 5 });
  const svg = gateway.files.get('flow.svg');
  assert.ok(svg, 'the SVG must be written');
  assert.match(svg, /<rect [^>]*id="n1"/);
  assert.match(svg, /<text [^>]*id="n1-label"/);
  assert.match(svg, /<line [^>]*id="connector-1"/);
  assert.match(svg, /<svg [^>]*width="800" height="600"/);
});

test('the created SVG round-trips through the strict codec', async () => {
  const gateway = new FakeSvgFileGateway();
  await tool(gateway, 'svg_create_flowchart').execute({
    path: 'flow.svg',
    nodes: NODES,
    edges: EDGES,
  });

  const inspection = await new SvgInspector(SvgRuntime.create()).inspect('flow.svg', gateway);
  assert.equal(inspection.elements, 5);
  assert.deepEqual(inspection.kinds, { rect: 2, line: 1, text: 2 });
  assert.deepEqual(inspection.rootChildren, ['n1', 'n1-label', 'n2', 'n2-label', 'connector-1']);
});

test('the canvas grows to fit nodes outside the minimum size', async () => {
  const gateway = new FakeSvgFileGateway();
  await tool(gateway, 'svg_create_flowchart').execute({
    path: 'big.svg',
    nodes: [{ id: 'wide', label: 'Wide', x: 900, y: 700, width: 200, height: 100 }],
    edges: [],
  });
  const inspection = await new SvgInspector(SvgRuntime.create()).inspect('big.svg', gateway);
  assert.equal(inspection.width, 1140);
  assert.equal(inspection.height, 840);
});

test('duplicate node ids fail clearly without polluting the next call', async () => {
  const gateway = new FakeSvgFileGateway();
  const flowchart = tool(gateway, 'svg_create_flowchart');

  await assert.rejects(
    () =>
      flowchart.execute({
        path: 'bad.svg',
        nodes: [NODES[0], NODES[0]],
        edges: [],
      }),
    /duplicate node id: n1/,
  );
  assert.equal(gateway.files.has('bad.svg'), false);

  const summary = await flowchart.execute({ path: 'good.svg', nodes: NODES, edges: EDGES });
  assert.deepEqual(summary, { path: 'good.svg', nodes: 2, connectors: 1, elements: 5 });
});

test('unknown edge endpoints and invalid geometry fail clearly', async () => {
  const gateway = new FakeSvgFileGateway();
  const flowchart = tool(gateway, 'svg_create_flowchart');

  await assert.rejects(
    () => flowchart.execute({ path: 'a.svg', nodes: NODES, edges: [{ from: 'n1', to: 'ghost' }] }),
    /unknown edge target: ghost/,
  );
  await assert.rejects(
    () =>
      flowchart.execute({
        path: 'a.svg',
        nodes: [{ id: 'n1', label: 'x', x: 0, y: 0, width: -5 }],
        edges: [],
      }),
    /width must be a positive number/,
  );
  await assert.rejects(
    () => flowchart.execute({ path: '', nodes: NODES, edges: [] }),
    /path must be a non-empty string/,
  );
});

test('a write failure surfaces and does not break the following call', async () => {
  const gateway = new FakeSvgFileGateway();
  const flowchart = tool(gateway, 'svg_create_flowchart');
  gateway.failWrite = true;

  await assert.rejects(
    () => flowchart.execute({ path: 'flow.svg', nodes: NODES, edges: EDGES }),
    /cannot write file/,
  );
  gateway.failWrite = false;
  const summary = (await flowchart.execute({
    path: 'flow.svg',
    nodes: NODES,
    edges: EDGES,
  })) as { elements: number };
  assert.equal(summary.elements, 5);
});

test('two calls keep their documents isolated', async () => {
  const gateway = new FakeSvgFileGateway();
  const flowchart = tool(gateway, 'svg_create_flowchart');

  await flowchart.execute({ path: 'one.svg', nodes: [NODES[0]], edges: [] });
  await flowchart.execute({ path: 'two.svg', nodes: [NODES[1]], edges: [] });

  const first = gateway.files.get('one.svg') ?? '';
  const second = gateway.files.get('two.svg') ?? '';
  assert.match(first, /id="n1"/);
  assert.doesNotMatch(first, /id="n2"/);
  assert.match(second, /id="n2"/);
  assert.doesNotMatch(second, /id="n1"/);
});

test('an aborted signal stops before writing', async () => {
  const gateway = new FakeSvgFileGateway();
  const flowchart = tool(gateway, 'svg_create_flowchart');
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () =>
      flowchart.execute(
        { path: 'flow.svg', nodes: NODES, edges: EDGES },
        { signal: controller.signal },
      ),
    /aborted/,
  );
  assert.equal(gateway.files.has('flow.svg'), false);
});
