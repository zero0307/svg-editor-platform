import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutFlowchart } from '../src/layoutFlowchart.js';
import { arrowWings, routeEdge } from '../src/edgeRouting.js';

const graph = {
  nodes: ['A', 'B', 'C'].map((id) => ({ id, label: id })),
  edges: [
    { id: 'e1', from: 'A', to: 'B' },
    { id: 'e2', from: 'B', to: 'C' },
    { id: 'e3', from: 'A', to: 'C' },
  ],
};
const chart = { ...layoutFlowchart(graph), path: 'shortcut.svg' };
const [a, b, c] = chart.nodes;
test('shortcut avoids the middle rectangle and ends with a visible arrow in both directions', () => {
  for (const [from, to] of [
    [a!, c!],
    [c!, a!],
  ] as const) {
    const path = routeEdge(chart, from, to, 0.5);
    assert.ok(path.length >= 4);
    const adjacent = routeEdge(chart, b!, to, 0.5);
    assert.notDeepEqual(
      [path.at(-1)!.x, path.at(-1)!.y],
      [adjacent.at(-1)!.x, adjacent.at(-1)!.y],
      'direct and bypass edges must have visibly distinct arrow tips',
    );
    for (const [i, p] of path.entries()) {
      assert.ok(p.x >= 0 && p.x <= chart.width && p.y >= 0 && p.y <= chart.height);
      if (i === 0) continue;
      const prev = path[i - 1]!;
      assert.ok(
        Math.max(prev.x, p.x) < b!.x ||
          Math.min(prev.x, p.x) > b!.x + b!.width ||
          Math.max(prev.y, p.y) < b!.y ||
          Math.min(prev.y, p.y) > b!.y + b!.height,
      );
    }
    const tip = path.at(-1)!,
      previous = path.at(-2)!;
    for (const wing of arrowWings(previous, tip))
      assert.ok(
        (tip.x - wing.x) * (tip.x - previous.x) + (tip.y - wing.y) * (tip.y - previous.y) > 0,
      );
  }
  assert.equal(routeEdge(chart, a!, b!, 0.5).length, 2);
  assert.notDeepEqual(routeEdge(chart, a!, b!, 1 / 3), routeEdge(chart, a!, b!, 2 / 3));
});
