import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { artwork } from '../src/artwork.js';
import { parseSvg } from '../src/chartDocument.js';
import { edgeTargets } from '../src/edgeTargets.js';
import { artworkTargets } from '../src/artworkTargets.js';

const cards =
  '<g id="node-a"><rect x="10" y="10" width="40" height="30"/><text>A</text></g><g id="node-b"><rect x="90" y="10" width="40" height="30"/><text>B</text></g><g id="node-c"><rect x="170" y="70" width="40" height="30"/><text>C</text></g>';
const marker = 'marker-end="url(#tip)"';
const fixtures = (shape: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 140"><defs><marker id="tip"><path d="M0 0L3 3"/></marker></defs>' +
  cards +
  '<g id="edges">' +
  shape +
  '</g><g id="legend"><line ' +
  marker +
  '/></g></svg>';
function filesFor(source: string) {
  const files = new Map([['in.svg', source]]);
  return {
    files,
    store: {
      read: async (p: string) => files.get(p)!,
      write: async (p: string, s: string) => {
        assert.ok(!files.has(p));
        files.set(p, s);
      },
    },
  };
}
for (const shape of [
  "<path d='M 53 25 h 33'",
  '<polyline points="53,25 86,25"',
  '<line x1="53" y1="25" x2="86" y2="25"',
])
  test('pick and reconnect only the named artwork ' + shape.slice(1, 5), async () => {
    const original = fixtures(shape + ' stroke="#e84" stroke-dasharray="6 4" ' + marker + '/>');
    const { files, store } = filesFor(original),
      inspect = await artwork(store, { operation: 'inspect', path: 'in.svg' });
    assert.ok('edges' in inspect);
    assert.equal(inspect.edges.length, 1);
    const [e] = inspect.edges;
    assert.deepEqual([e!.from, e!.to], ['node-a', 'node-b']);
    const req = {
      path: 'in.svg',
      output: 'out.svg',
      operation: 'reconnect' as const,
      edgeId: e!.edgeId,
      originalGeometry: e!.originalGeometry,
      to: 'node-c',
    };
    await assert.rejects(
      artwork(store, { ...req, originalGeometry: 'stale' }),
      /no longer matches/,
    );
    await assert.rejects(artwork(store, { ...req, to: 'node-a' }), /distinct/);
    const result = await artwork(store, req);
    assert.ok('edgeId' in result);
    assert.deepEqual(
      [result.from, result.to, result.otherBytesUnchanged],
      ['node-a', 'node-c', true],
    );
    assert.equal(files.get('in.svg'), original);
    assert.equal(files.size, 2);
    const output = files.get('out.svg')!;
    const strip = (s: string) => s.replace(/\b(?:d|points|x1|x2|y1|y2)=(["']).*?\1/g, '');
    assert.equal(strip(output), strip(original));
    const check = await artwork(store, { operation: 'inspect', path: 'out.svg' });
    assert.ok('edges' in check);
    assert.deepEqual([check.edges[0]!.from, check.edges[0]!.to], ['node-a', 'node-c']);
  });
test('only the chosen anonymous edge changes and detached arrowheads are never left behind', async () => {
  const before = fixtures(
    '<path d="M50 25H90" ' +
      marker +
      '/><!-- same coordinates --><path d="M50 25H90" ' +
      marker +
      '/>' +
      '<path d="M50 25H170"/>',
  );
  const { files, store } = filesFor(before);
  const result = await artwork(store, { path: 'in.svg', operation: 'inspect' });
  assert.ok('edges' in result);
  const [, second, split] = result.edges;
  const req = { path: 'in.svg', output: 'out.svg', operation: 'reconnect' as const, to: 'node-c' };
  await assert.rejects(
    artwork(store, { ...req, edgeId: split!.edgeId, originalGeometry: split!.originalGeometry }),
    /attached/,
  );
  await artwork(store, {
    ...req,
    edgeId: second!.edgeId,
    originalGeometry: second!.originalGeometry,
  });
  assert.ok(
    files
      .get('out.svg')!
      .includes('<path d="M50 25H90" ' + marker + '/><!-- same coordinates --><path d="M '),
  );
});
test('the trunk, both wings and each branch select one native K/V edge', async () => {
  const source = await readFile(
    new URL('../../../../doc/evidence/dsh/presentation/cross-attention.svg', import.meta.url),
    'utf8',
  );
  const root = parseSvg(source),
    edges = edgeTargets(root, artworkTargets(root));
  assert.deepEqual(
    edges.map((e) => e.id),
    ['q', 'kv', 'out'],
  );
  const kv = edges[1]!;
  assert.equal(kv.artwork, false);
  assert.equal(kv.from, 'memory');
  assert.equal(kv.to, 'cross');
  assert.equal(kv.parts.length, kv.element.getElementsByTagName('line').length);
});

test('a style-only edit promotes a straight primitive and keeps its exact anchors, marker, identity and accessible title', async () => {
  for (const originalShape of [
    '<line id="link" x1="53" y1="25" x2="86" y2="25" ',
    '<polyline id="link" points="53,25 86,25" ',
    '<path id="link" d="M53 25H86" ',
  ]) {
    const kind = originalShape.slice(1, originalShape.indexOf(' '));
    const original = fixtures(
      originalShape +
        marker +
        ' stroke="#345" stroke-dasharray="4 2"><title>link &amp; notes</title></' +
        kind +
        '>',
    );
    const { files, store } = filesFor(original);
    const get = async (path: string) => {
      const res = await artwork(store, { path, operation: 'inspect' });
      assert.ok('edges' in res);
      return res.edges[0]!;
    };
    const edit = async (
      path: string,
      output: string,
      style: 'arc' | 'straight',
      from?: string,
      to?: string,
    ) => {
      const e = await get(path);
      return artwork(store, {
        path,
        output,
        operation: 'reconnect',
        connectorStyle: style,
        edgeId: e.edgeId,
        originalGeometry: e.originalGeometry,
        from,
        to,
      });
    };
    await edit('in.svg', 'arc.svg', 'arc');
    const raw = files.get('arc.svg')!,
      e = parseSvg(raw).getElementsByTagName('path');
    const picked = Array.from(e).find((p) => p.getAttribute('id') === 'link')!;
    assert.match(picked.getAttribute('d')!, /^M 53 25 Q .+ 86 25$/);
    assert.equal(picked.getAttribute('marker-end'), 'url(#tip)');
    assert.equal(picked.getAttribute('stroke-dasharray'), '4 2');
    assert.equal(picked.textContent, 'link & notes');
    assert.deepEqual(
      [(await get('arc.svg')).from, (await get('arc.svg')).to],
      ['node-a', 'node-b'],
    );
    await edit('arc.svg', 'straight.svg', 'straight');
    assert.equal(
      parseSvg(files.get('straight.svg')!).ownerDocument!.getElementById('link')!.getAttribute('d'),
      'M 53 25 L 86 25',
    );
    await edit('straight.svg', 'both.svg', 'arc', 'node-c', 'node-a');
    assert.deepEqual(
      [(await get('both.svg')).from, (await get('both.svg')).to],
      ['node-c', 'node-a'],
    );
    assert.equal(files.get('in.svg'), original);
  }
});
test('a blocked explicit straight edit saves nothing', async () => {
  const source = fixtures('<path d="M 50 25 L 50 115 L 220 115 L 210 85" ' + marker + '/>').replace(
    '<g id="edges">',
    '<g id="node-wall"><rect x="71" y="31" width="45" height="40"/><text>Wall</text></g><g id="edges">',
  );
  const { files, store } = filesFor(source);
  const res = await artwork(store, { path: 'in.svg', operation: 'inspect' });
  assert.ok('edges' in res);
  const e = res.edges[0]!;
  await assert.rejects(
    artwork(store, {
      path: 'in.svg',
      output: 'no.svg',
      operation: 'reconnect',
      edgeId: e.edgeId,
      originalGeometry: e.originalGeometry,
      from: 'node-a',
      to: 'node-c',
      connectorStyle: 'straight',
    }),
    /cross|clear/,
  );
  assert.equal(files.size, 1);
});

test('an anonymous position and geometry cannot be reused after coincident red and blue connectors swap', async () => {
  const red = '<path stroke="red" d="M50 25H90" ' + marker + '/>';
  const blue = red.replace('red', 'blue');
  const { store, files } = filesFor(fixtures(red + blue));
  const before = await artwork(store, { operation: 'inspect', path: 'in.svg' });
  assert.ok('edges' in before);
  const args = {
    operation: 'reconnect' as const,
    path: 'in.svg',
    output: 'out.svg',
    connectorStyle: 'arc' as const,
    edgeId: before.edges[0]!.edgeId,
    originalGeometry: before.edges[0]!.originalGeometry,
  };
  const reordered = fixtures(blue + red);
  files.set('in.svg', reordered);
  await assert.rejects(artwork(store, args), /no longer matches/);
  assert.deepEqual([...files], [['in.svg', reordered]]);
  const current = await artwork(store, { operation: 'inspect', path: 'in.svg' });
  assert.ok('edges' in current);
  const repicked = current.edges[1]!;
  await artwork(store, {
    ...args,
    edgeId: repicked.edgeId,
    originalGeometry: repicked.originalGeometry,
  });
  assert.ok(files.get('out.svg')!.includes(blue));
  assert.match(files.get('out.svg')!, /stroke="red" d="M [^"]* Q /);
});

test('obstructed connections at translated origins, in both axes and directions, survive independent curve sampling', async () => {
  for (const [ox, oy] of [
    [0, 0],
    [-360, -70],
    [25, 40],
    [-55, 120],
  ] as const) {
    for (const vertical of [false, true])
      for (const reverse of [false, true]) {
        const pt = (u: number, v: number) =>
          vertical ? ([ox + v, oy + u] as const) : ([ox + u, oy + v] as const);
        const card = (id: string, u: number, v: number, w: number, h: number) => {
          const [x, y] = pt(u, v);
          return (
            '<g id="node-' +
            id +
            '"><rect x="' +
            x +
            '" y="' +
            y +
            '" width="' +
            (vertical ? h : w) +
            '" height="' +
            (vertical ? w : h) +
            '"/><text>复核</text></g>'
          );
        };
        const start = pt(reverse ? 310 : 70, 110),
          end = pt(reverse ? 70 : 310, 110);
        const source =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
          [ox, oy, vertical ? 240 : 380, vertical ? 380 : 240].join(' ') +
          '"><defs><marker id="tip"><path d="M0 0L4 2L0 4Z"/></marker></defs>' +
          card('a', 20, 90, 50, 40) +
          card('b', 310, 90, 50, 40) +
          card('wall', 173, 101, 34, 18) +
          '<g id="edges"><path id="arrow" fill="none" stroke="#367" ' +
          marker +
          ' d="M' +
          start.join(' ') +
          'L' +
          end.join(' ') +
          '"/></g></svg>';
        const { files, store } = filesFor(source);
        const info = await artwork(store, { operation: 'inspect', path: 'in.svg' });
        assert.ok('edges' in info);
        const edge = info.edges[0]!;
        const ends = reverse ? ['node-b', 'node-a'] : ['node-a', 'node-b'];
        assert.deepEqual([edge.from, edge.to], ends);
        const args = {
          operation: 'reconnect' as const,
          path: 'in.svg',
          output: 'out.svg',
          edgeId: edge.edgeId,
          originalGeometry: edge.originalGeometry,
        };
        await assert.rejects(
          artwork(store, { ...args, connectorStyle: 'straight' }),
          /cross|clear/,
        );
        assert.deepEqual([...files], [['in.svg', source]]);
        await artwork(store, { ...args, connectorStyle: 'arc' });
        const out = files.get('out.svg')!;
        const geom = parseSvg(out).ownerDocument!.getElementById('arrow')!.getAttribute('d')!;
        assert.match(geom, /^M [^A-Z]* Q [^A-Z]+$/);
        const [ax, ay, cx, cy, bx, by] = geom.match(/-?[\d.]+/g)!.map(Number) as [
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        assert.deepEqual([ax, ay, bx, by], [...start, ...end]);
        assert.ok(Math.abs((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) > 1);
        const [wallX, wallY] = pt(173, 101);
        for (let i = 0; i <= 200; i++) {
          const t = i / 200,
            s = 1 - t,
            x = s * s * ax + 2 * s * t * cx + t * t * bx,
            y = s * s * ay + 2 * s * t * cy + t * t * by;
          assert.ok(
            x >= ox &&
              y >= oy &&
              x <= ox + (vertical ? 240 : 380) &&
              y <= oy + (vertical ? 380 : 240),
          );
          assert.ok(
            x < wallX ||
              x > wallX + (vertical ? 18 : 34) ||
              y < wallY ||
              y > wallY + (vertical ? 34 : 18),
          );
        }
        assert.equal(
          out.replace('d="' + geom + '"', 'd="M' + start.join(' ') + 'L' + end.join(' ') + '"'),
          source,
        );
        assert.equal(files.get('in.svg'), source);
        const reread = await artwork(store, { operation: 'inspect', path: 'out.svg' });
        assert.ok('edges' in reread);
        assert.deepEqual([reread.edges[0]!.from, reread.edges[0]!.to], ends);
      }
  }
});
