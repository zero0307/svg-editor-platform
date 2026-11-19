import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutFlowchart } from '../src/layoutFlowchart.js';

const nodes = ['pass', 'submit', 'review', 'check'].map((id) => ({ id, label: id }));
const edges = [
  { id: 'a', from: 'submit', to: 'check' },
  { id: 'b', from: 'submit', to: 'review' },
  { id: 'c', from: 'check', to: 'pass' },
  { id: 'd', from: 'review', to: 'pass' },
  { id: 'e', from: 'submit', to: 'pass' },
];

test('longest predecessor path sets the columns; input order sets rows even if edges are reversed', () => {
  const graph = { nodes, edges };
  const plan = layoutFlowchart(graph);
  assert.deepEqual(plan, layoutFlowchart(graph));
  assert.deepEqual(plan.nodes, layoutFlowchart({ nodes, edges: edges.slice().reverse() }).nodes);
  assert.deepEqual(plan.edges, edges);
  assert.deepEqual(
    plan.nodes.map((n) => n.id),
    nodes.map((n) => n.id),
  );
  const [pass, submit, review, check] = plan.nodes;
  assert.ok(submit!.x < review!.x && review!.x < pass!.x);
  assert.equal(review!.x, check!.x);
  assert.ok(review!.y < check!.y);
  assert.ok(nodes.every((n) => !Object.hasOwn(n, 'x')));
});

test('isolated nodes, a disconnected chain and long Unicode labels fit without overlap', () => {
  const graph = {
    nodes: [...nodes, { id: '孤立', label: '超长中文节点标题'.repeat(8) }],
    edges: [edges[2]!],
  };
  for (const input of [graph, { nodes: [graph.nodes[4]!], edges: [] }]) {
    const plan = layoutFlowchart(input);
    for (const [i, n] of plan.nodes.entries()) {
      assert.ok(
        n.x >= 0 && n.y >= 0 && n.x + n.width <= plan.width && n.y + n.height <= plan.height,
      );
      for (const other of plan.nodes.slice(i + 1))
        assert.ok(
          n.x + n.width <= other.x ||
            other.x + other.width <= n.x ||
            n.y + n.height <= other.y ||
            other.y + other.height <= n.y,
        );
    }
  }
});
test('invalid graphs identify the input and leave the next layout usable', () => {
  const graph = { nodes, edges };
  assert.throws(() => layoutFlowchart({ nodes: [], edges: [] }), /at least one/);
  assert.throws(() => layoutFlowchart({ nodes: [...nodes, nodes[0]!], edges }), /duplicate.*pass/);
  assert.throws(
    () => layoutFlowchart({ nodes: [...nodes, { id: 'submit-label', label: 'x' }], edges }),
    /duplicate.*submit-label/,
  );
  assert.throws(
    () => layoutFlowchart({ nodes, edges: [{ id: 'check-rect', from: 'submit', to: 'pass' }] }),
    /duplicate.*check-rect/,
  );
  assert.throws(
    () => layoutFlowchart({ nodes, edges: [{ id: 'bad', from: 'submit', to: 'missing' }] }),
    /endpoint missing.*bad/,
  );
  assert.throws(
    () => layoutFlowchart({ nodes, edges: [{ id: 'bad', from: 'submit', to: 'submit' }] }),
    /Self-loop.*submit/,
  );
  assert.throws(
    () => layoutFlowchart({ nodes, edges: [...edges, { id: 'back', from: 'pass', to: 'submit' }] }),
    /Cycle.*pass/,
  );
  assert.throws(
    () => layoutFlowchart({ nodes: [{ id: 'a', label: '\u0000' }], edges: [] }),
    /XML text.*a/,
  );
  assert.equal(layoutFlowchart(graph).nodes.length, 4);
});
