import { createHash } from 'node:crypto';
import { portEdits } from '../src/portEdits.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { FileStore } from '@svgframe/core';
import { editFlowchart } from '../src/editFlowchart.js';
import { checkFlowchart } from '../src/checkFlowchart.js';
import { nativeGraph, parseSvg, serialize } from '../src/chartDocument.js';
import { fixture } from './fixture.js';

async function setup() {
  const f = fixture();
  const store: FileStore = {
    read: async (p) => {
      if (!f.files.has(p)) throw Error('missing');
      return f.files.get(p)!;
    },
    write: async (p, s) => {
      if (f.files.has(p)) throw Error('exists');
      f.files.set(p, s);
    },
  };
  await f.tools.createFlowchart({
    path: 'before.svg',
    width: 880,
    height: 420,
    nodes: [
      { id: 's', label: '编码器输出', x: 40, y: 160, width: 120, height: 60 },
      { id: 'k', label: 'K', x: 450, y: 130, width: 42, height: 28 },
      { id: 'v', label: 'V', x: 450, y: 212, width: 42, height: 28 },
      { id: 't', label: '注意力', x: 570, y: 130, width: 150, height: 120 },
      { id: 'q', label: '解码器', x: 582, y: 310, width: 120, height: 50 },
    ],
    edges: [
      { id: 'sk', from: 's', to: 'k' },
      { id: 'kt', from: 'k', to: 't' },
      { id: 'sv', from: 's', to: 'v' },
      { id: 'vt', from: 'v', to: 't' },
      { id: 'qt', from: 'q', to: 't', inputs: ['Q'] },
    ],
  });
  return { store, files: f.files };
}
const merge = {
  path: 'before.svg',
  output: 'after.svg',
  operation: 'merge_inputs',
  from: 's',
  to: 't',
  inputs: ['K', 'V'],
} as const;
const req = () => ({ ...merge, inputs: [...merge.inputs] });
test('merge proxy ports without disturbing Q; inspect physical arrows independently of the requested patch', async () => {
  const { store, files } = await setup();
  const before = files.get('before.svg')!;
  assert.deepEqual(portEdits((await nativeGraph(before)).graph), [
    {
      tool: 'svg_edit_flowchart',
      operation: 'merge_inputs',
      from: 's',
      to: 't',
      inputs: ['K', 'V'],
    },
  ]);
  const expected = { connections: [{ from: 's', to: 't', inputs: ['K', 'V'] }] };
  assert.equal((await checkFlowchart(before, expected)).status, 'failed');
  const result = await editFlowchart(store, req());
  assert.equal(result.unrelatedNodesMoved, 0);
  assert.equal(files.get('before.svg'), before);
  const after = files.get('after.svg')!;
  assert.equal((await checkFlowchart(after, expected)).status, 'passed');
  for (const id of ['s', 't', 'q', 'qt'])
    assert.equal(
      serialize(parseSvg(before).ownerDocument!.getElementById(id)!),
      serialize(parseSvg(after).ownerDocument!.getElementById(id)!),
    );
  assert.ok(files.get(result.preview!)?.includes('修改前'));
  await assert.rejects(editFlowchart(store, req()), /exists/);
  const broken = parseSvg(after);
  const wing = Array.from(broken.getElementsByTagName('g')).find(
    (e) => e.getAttribute('data-dsh-part') === 'port' && e.textContent?.trim() === 'K',
  )!;
  const line = Array.from(wing.getElementsByTagName('line')).find(
    (e) => e.getAttribute('data-dsh-part') === 'arrow',
  )!;
  wing.removeChild(line);
  const check = await checkFlowchart(serialize(broken), expected);
  assert.equal(check.status, 'failed');
  assert.match(check.problems.join(' '), /incomplete arrow: K/);
  assert.equal(check.locations?.length, 1);
});
test('missing or shared auxiliary nodes fail before write; non-native geometry stays unverified', async () => {
  const { store, files } = await setup();
  await assert.rejects(editFlowchart(store, { ...req(), inputs: ['K', 'X'] }), /Missing/);
  const bad = files.get('before.svg')!.replace('data-dsh-from="q"', 'data-dsh-from="k"');
  files.set('before.svg', bad);
  await assert.rejects(editFlowchart(store, req()));
  assert.equal(files.has('after.svg'), false);
  const generic = '<svg xmlns="http://www.w3.org/2000/svg" role="img"><text>词嵌入</text></svg>';
  const check = await checkFlowchart(generic, { labels: [{ label: '词嵌入', minimum: 2 }] });
  assert.equal(check.status, 'unverified');
  assert.match(check.problems.join(' '), /1.*2/);
});
test('native preexisting named forks and independently specified missing required node', async () => {
  const { store, files } = await setup();
  const src = await readFile(
    new URL('../../../../doc/evidence/dsh/qkv/Transformer.svg', import.meta.url),
    'utf8',
  );
  files.set('before.svg', src);
  await editFlowchart(store, { ...req(), from: 'enc-norm2', to: 'dec-cross' });
  assert.equal(
    (await checkFlowchart(files.get('after.svg')!, { requiredNodes: ['missing-embedding'] }))
      .status,
    'failed',
  );
});
test('insert a gate, rename it, and reconnect a branch; reject overlapping placement', async () => {
  const { store, files } = await setup();
  await assert.rejects(
    editFlowchart(store, {
      path: 'before.svg',
      output: 'bad.svg',
      operation: 'insert',
      edgeId: 'sk',
      nodeId: 'gate',
      label: '安全检查',
      x: 45,
      y: 162,
    }),
    /free/,
  );
  assert.equal(files.has('bad.svg'), false);
  await editFlowchart(store, {
    path: 'before.svg',
    output: 'insert.svg',
    operation: 'insert',
    edgeId: 'sk',
    nodeId: 'gate',
    label: '安全检查',
    x: 215,
    y: 42,
    width: 110,
    height: 40,
  });
  await editFlowchart(store, {
    path: 'insert.svg',
    output: 'renamed.svg',
    operation: 'rename',
    nodeId: 'gate',
    label: '安全审查（复核）',
  });
  await editFlowchart(store, {
    path: 'renamed.svg',
    output: 'reconnected.svg',
    operation: 'reconnect',
    edgeId: 'sv',
    from: 'gate',
    to: 'v',
  });
  const { graph } = await nativeGraph(files.get('reconnected.svg')!);
  assert.equal(graph.nodes.find((n) => n.id === 'gate')?.label, '安全审查（复核）');
  assert.ok(graph.edges.some((e) => e.from === 'gate' && e.to === 'v'));
  assert.ok(graph.edges.some((e) => e.from === 's' && e.to === 'gate'));
});
test('pointed line rename preserves all other bytes, even with duplicate titles, CRLF and entities', async () => {
  const { files, store } = await setup();
  const f = fixture();
  await f.tools.createFlowchart({
    path: 'x.svg',
    width: 480,
    height: 200,
    nodes: [
      { id: 'left', label: 'Add & Norm\r\n副标题', x: 10, y: 20, width: 180, height: 80 },
      { id: 'right', label: 'Add & Norm\r\n副标题', x: 250, y: 20, width: 180, height: 80 },
    ],
    edges: [],
  });
  const original = f.files.get('x.svg')!.replace(/\r?\n/g, '\r\n');
  files.set('before.svg', original);
  const request = {
    path: 'before.svg',
    output: 'out.svg',
    operation: 'rename' as const,
    nodeId: 'right',
    labelLine: 1,
    label: '新 <&>',
  };
  const actual = await editFlowchart(store, request);
  assert.equal(actual.changedNode, 'right');
  assert.equal(actual.diskReadBack?.originalUnchanged, true);
  assert.equal(
    actual.diskReadBack?.outputSha256,
    createHash('sha256').update(files.get('out.svg')!).digest('hex'),
  );
  const single = await f.tools.inspectNode('x.svg', 'right');
  assert.equal(single.node.label, 'Add & Norm\r\n副标题');
  assert.equal(single.nodeCount, 2);
  assert.ok(!('structure' in single));
  await assert.rejects(f.tools.inspectNode('x.svg', 'missing'), /No graph node/);
  assert.equal(files.get('before.svg'), original);
  assert.equal(
    files.get('out.svg'),
    original.replace(/(<text id="right-label"[^>]*>)Add &amp; Norm/, '$1新 &lt;&amp;&gt;'),
  );
  for (const line of [0, 1.5, 3])
    await assert.rejects(editFlowchart(store, { ...request, output: 'no.svg', labelLine: line }));
  await assert.rejects(
    editFlowchart(store, { ...request, output: 'no.svg', label: '太长'.repeat(100) }),
    /reflow/,
  );
  assert.ok(!files.has('no.svg'));
});
