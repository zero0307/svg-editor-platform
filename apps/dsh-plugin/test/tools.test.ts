import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocumentView, FileStore } from '@svgframe/core';
import { FakeEditorSession } from '@svgframe/core/testing';
import { SvgTools, type Chart } from '../src/SvgTools.js';
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
          attributes: {},
          text: r.type === 'text' ? r.args[2]! : null,
          children: [],
        }),
        files,
      ),
  );
  assert.deepEqual(await tools.createFlowchart(chart), { path: chart.path, nodes: 2, edges: 1 });
  const view = await tools.inspect(chart.path);
  assert.deepEqual(view.counts, { line: 1, g: 2, rect: 2, text: 2 });
  assert.deepEqual(
    view.structure.find((s) => s.id === 'a-label'),
    { id: 'a-label', type: 'text', parent: 'a', text: '开始 & <继续>' },
  );
});

test('real codec round-trips Unicode and XML escaping, geometry and warnings', async () => {
  const { files, tools } = fixture();
  await tools.createFlowchart(chart);
  assert.match(files.get(chart.path)!, /开始 &amp; &lt;继续/);
  assert.match(files.get(chart.path)!, /x1="48" y1="27" x2="245" y2="97.5"/);
  const view = await tools.inspect(chart.path);
  assert.deepEqual([view.width, view.height, view.structure.length], [350, 150, 7]);
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
  assert.equal((await tools.inspect(chart.path)).structure.length, 7);
});
