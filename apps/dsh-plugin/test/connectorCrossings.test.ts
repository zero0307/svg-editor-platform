import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { artwork } from '../src/artwork.js';
import { memorySession, parseSvg } from '../src/chartDocument.js';
import { crossingCount } from '../src/connectorCrossings.js';
import { connectorSegments } from '../src/connectorSegments.js';
import { edgeTargets } from '../src/edgeTargets.js';
import { prepareNativeEdit } from '../src/nativeEditCandidate.js';
import { SvgTools } from '../src/SvgTools.js';
import { shapeRoute } from '../src/curveRoute.js';

// Independent oracle for these fixtures: evaluate the analytic vertical extrema
// of the delivered quadratic against the known horizontal connector corridors.
function verticalRange(d: string) {
  assert.match(d, /^M [^A-Z]* Q [^A-Z]+$/);
  const [, a, , c, , b] = d.match(/[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi)!.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const t = (a - c) / (a - 2 * c + b),
    values = [a, b];
  if (t > 0 && t < 1) values.push((1 - t) ** 2 * a + 2 * t * (1 - t) * c + t ** 2 * b);
  return [Math.min(...values), Math.max(...values)] as const;
}
test('parallel artwork bands: 16 gap combinations leave all other SVG bytes intact', async () => {
  const template = await readFile(
    new URL('../../demo/dense-connectors.svg', import.meta.url),
    'utf8',
  );
  for (const upper of [82, 85, 88, 91])
    for (const lower of [160, 163, 166, 170]) {
      const source = template
        .replace('M120 82H430', 'M120 ' + upper + 'H430')
        .replaceAll('M120 170H430', 'M120 ' + lower + 'H430');
      const files = new Map([['in.svg', source]]);
      const store = {
        read: async (p: string) => files.get(p)!,
        write: async (p: string, s: string) => {
          files.set(p, s);
        },
      };
      const info = await artwork(store, { path: 'in.svg', operation: 'inspect' });
      assert.ok('edges' in info);
      const edge = info.edges[0]!;
      await artwork(store, {
        path: 'in.svg',
        output: 'out.svg',
        operation: 'reconnect',
        edgeId: edge.edgeId,
        originalGeometry: edge.originalGeometry,
        to: 'node-out-b',
        connectorStyle: 'arc',
      });
      const out = files.get('out.svg')!,
        d = parseSvg(out).ownerDocument!.getElementById('upper')!.getAttribute('d')!;
      const [lo, hi] = verticalRange(d);
      assert.ok(lo > upper && hi < lower, JSON.stringify({ upper, lower, d }));
      assert.equal(out.replace('d="' + d + '"', 'd="M120 78H430"'), source);
      assert.equal(files.get('in.svg'), source);
    }
});
test('native generation and single-edge editing avoid a fixed line in either paint order', async () => {
  const node = (id: string, x: number, y: number) => ({
    id,
    label: id,
    x,
    y,
    width: 44,
    height: 24,
  });
  const nodes = [
    node('a', 40, 138),
    node('b', 420, 138),
    node('left', 0, 108),
    node('right', 472, 108),
  ];
  const arc = { id: 'bow', from: 'a', to: 'b' },
    fixed = { id: 'fixed', from: 'left', to: 'right' };
  for (const edges of [
    [arc, fixed],
    [fixed, arc],
  ]) {
    const scratch = memorySession('');
    const make = async (style: 'angular' | 'arc') => {
      await new SvgTools(scratch.session).createFlowchart({
        path: 'in.svg',
        width: 520,
        height: 280,
        nodes,
        edges,
        edgeStyles: [{ ids: ['bow'], style }],
      });
      return scratch.contents();
    };
    const straight = await make('angular');
    const built = await make('arc');
    const edit = await prepareNativeEdit(straight, {
      path: 'in.svg',
      output: 'out.svg',
      operation: 'reconnect',
      edgeId: 'bow',
      connectorStyle: 'arc',
    });
    const pathOf = (svg: string) => {
      const root = parseSvg(svg);
      const group = root.ownerDocument!.getElementById('bow')!;
      return group.getElementsByTagName('path')[0]!.getAttribute('d')!;
    };
    assert.ok(verticalRange(pathOf(built))[0] > 120);
    assert.equal(pathOf(built), pathOf(edit.after));
    assert.deepEqual(edit.graph.edges, edges);
    assert.deepEqual(edit.warnings, []);
    const fixedGroup = (s: string) =>
      parseSvg(s).ownerDocument!.getElementById('fixed')!.toString();
    assert.equal(fixedGroup(edit.after), fixedGroup(straight));
  }
});
test('crossing score distinguishes two intersections, tangencies, shared anchors and unavoidable hits', () => {
  const p = (x: number, y: number) => ({ x, y });
  const start = p(0, 0),
    end = p(100, 0),
    control = p(50, 100);
  const line = (x1: number, y1: number, x2: number, y2: number) => ({
    start: p(x1, y1),
    end: p(x2, y2),
  });
  const forced = line(50, -80, 50, 80);
  assert.equal(crossingCount(start, control, end, [forced, line(0, 30, 100, 30)]), 3);
  assert.equal(crossingCount(start, p(50, -100), end, [forced, line(0, 30, 100, 30)]), 1);
  assert.equal(crossingCount(start, control, end, [line(0, 50, 50, 50), line(50, 50, 100, 50)]), 1);
  assert.equal(crossingCount(start, control, end, [line(-50, 0, 120, 0)]), 0);
});
test('SVG path commands, transforms and negative origins map to the same neighbour coordinate system', () => {
  const root = parseSvg(
    '<svg xmlns="http://www.w3.org/2000/svg"><g id="edges" transform="translate(-30 12)"><g transform="scale(2)"><path d="m5 10 h10 v5 q5 -5 10 0 t10 0 c2 -2 4 2 6 0 s4 0 6 0 a6 8 0 0 1 12 0"/><polyline points="1,2 4,6 8,9"/></g></g></svg>',
  );
  const [edge, poly] = edgeTargets(root, []);
  const seg = connectorSegments([edge!], -40, -20);
  assert.deepEqual(seg[0], { start: { x: 20, y: 52 }, end: { x: 40, y: 52 } });
  assert.deepEqual(seg[1], { start: { x: 40, y: 52 }, end: { x: 40, y: 62 } });
  assert.ok(seg.length > 10);
  assert.ok(Math.abs(seg.at(-1)!.end.x - 128) < 1e-7 && Math.abs(seg.at(-1)!.end.y - 62) < 1e-7);
  assert.deepEqual(connectorSegments([poly!], -40, -20).at(-1), {
    start: { x: 18, y: 44 },
    end: { x: 26, y: 50 },
  });
});

test('when one transverse crossing is inevitable the chosen route remains an arc and avoids additional crossings', () => {
  const from = { id: 'a', label: 'A', x: 10, y: 90, width: 40, height: 20 },
    to = { ...from, id: 'b', x: 250 };
  const chart = { path: 'in.svg', width: 320, height: 220, nodes: [from, to], edges: [] };
  const start = { x: 50, y: 100 },
    end = { x: 250, y: 100 };
  const forced = { start: { x: 150, y: 0 }, end: { x: 150, y: 220 } };
  const extra = { start: { x: 50, y: 80 }, end: { x: 250, y: 80 } };
  const selected = (neighbours: (typeof forced)[]) =>
    shapeRoute([start, end], 'arc', chart, from, to, neighbours)[0]!;
  const original = selected([]);
  assert.ok(
    verticalRange('M 50 100 Q ' + original.control!.x + ' ' + original.control!.y + ' 250 100')[0] <
      80,
  );
  const arc = selected([forced, extra]);
  assert.deepEqual(arc.start, start);
  assert.deepEqual(arc.end, end);
  assert.ok(arc.control && arc.control.y !== 100);
  assert.ok(
    verticalRange('M 50 100 Q ' + arc.control.x + ' ' + arc.control.y + ' 250 100')[0] > 80,
  );
  // All admissible candidates go from x=50 to x=250, so each must cross x=150.
  assert.deepEqual(selected([forced]), original);
});
