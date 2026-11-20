// Geometry and topology assertions operate solely on the input graph and serialized SVG.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import { SvgTools } from '../dist/src/SvgTools.js';
import { layoutFlowchart } from '../dist/src/layoutFlowchart.js';
import { Phase1EditorSession } from '../dist/src/session.cjs';

const eps = 1e-5;
const point = (x, y) => ({ x, y });
const minus = (a, b) => point(a.x - b.x, a.y - b.y);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const length = (v) => Math.hypot(v.x, v.y);
const gap = (a, b) => length(minus(a, b));
const midpoint = (a, b) => point((a.x + b.x) / 2, (a.y + b.y) / 2);
const children = (e) => Array.from(e.childNodes).filter((n) => n.nodeType === 1);
const num = (e, key) => {
  assert.ok(e.hasAttribute(key), 'Missing ' + key);
  const n = Number(e.getAttribute(key));
  assert.ok(Number.isFinite(n));
  return n;
};

function boundary(body, p) {
  if (body.tagName === 'ellipse') {
    const radiusX = num(body, 'rx'),
      radiusY = num(body, 'ry');
    return (
      (Math.hypot((p.x - num(body, 'cx')) / radiusX, (p.y - num(body, 'cy')) / radiusY) - 1) *
      Math.min(radiusX, radiusY)
    );
  }
  const w = num(body, 'width') / 2,
    h = num(body, 'height') / 2,
    r = Math.min(Number(body.getAttribute('rx') ?? 0), w, h);
  const x = Math.abs(p.x - num(body, 'x') - w) - w + r,
    y = Math.abs(p.y - num(body, 'y') - h) - h + r;
  return Math.hypot(Math.max(0, x), Math.max(0, y)) + Math.min(Math.max(x, y), 0) - r;
}

function geometry(element) {
  if (element.tagName === 'line')
    return {
      a: point(num(element, 'x1'), num(element, 'y1')),
      b: point(num(element, 'x2'), num(element, 'y2')),
    };
  assert.equal(element.tagName, 'path');
  const fields = element
    .getAttribute('d')
    .trim()
    .split(/[\s,]+/);
  assert.equal(fields.length, 8);
  assert.equal(fields[0], 'M');
  assert.equal(fields[3], 'Q');
  const coords = fields.filter((_, i) => i !== 0 && i !== 3).map(Number);
  assert.ok(coords.every(Number.isFinite));
  return {
    a: point(coords[0], coords[1]),
    c: point(coords[2], coords[3]),
    b: point(coords[4], coords[5]),
  };
}

// Subdivide until the control point differs from the chord midpoint by at most 0.02 SVG units.
function flatten({ a, c, b }, out) {
  const center = midpoint(a, b);
  if (!c || gap(center, c) <= 0.02) {
    out.push({ a, b });
    return;
  }
  const left = midpoint(a, c),
    right = midpoint(c, b),
    split = midpoint(left, right);
  flatten({ a, c: left, b: split }, out);
  flatten({ a: split, c: right, b }, out);
}

function intersection(first, second) {
  const r = minus(first.b, first.a),
    s = minus(second.b, second.a),
    offset = minus(second.a, first.a),
    det = cross(r, s);
  if (Math.abs(det) < eps) {
    if (Math.abs(cross(offset, r)) > eps) return;
    const rr = dot(r, r),
      lo = dot(offset, r) / rr,
      hi = lo + dot(s, r) / rr;
    const start = Math.max(0, Math.min(lo, hi)),
      end = Math.min(1, Math.max(lo, hi));
    if (end < start - eps) return;
    if ((end - start) * length(r) > 0.02) return 'overlap';
    return point(first.a.x + start * r.x, first.a.y + start * r.y);
  }
  const t = cross(offset, s) / det,
    u = cross(offset, r) / det;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return;
  return point(first.a.x + t * r.x, first.a.y + t * r.y);
}

function audit(input, svg) {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const width = num(root, 'width'),
    height = num(root, 'height');
  const groups = children(root).filter((e) => e.tagName === 'g');
  const bodies = new Map(
    groups
      .filter((g) => g.getAttribute('data-dsh-role') === 'node')
      .map((g) => [
        g.getAttribute('id'),
        children(g).find((c) => ['rect', 'ellipse'].includes(c.tagName)),
      ]),
  );
  const connectors = groups.filter((g) => g.getAttribute('data-dsh-role') === 'edge');
  assert.deepEqual([...bodies.keys()].sort(), input.nodes.map((n) => n.id).sort());
  assert.deepEqual(
    connectors.map((g) => g.getAttribute('id')).sort(),
    input.edges.map((e) => e.id).sort(),
  );
  const inks = [];
  for (const { id, from, to, inputs } of input.edges) {
    const group = connectors.find((g) => g.getAttribute('id') === id);
    assert.equal(group.getAttribute('data-dsh-from'), from);
    assert.equal(group.getAttribute('data-dsh-to'), to);
    const pieces = children(group);
    const route = pieces.filter((p) => p.getAttribute('data-dsh-part') === 'route').map(geometry);
    function arrowInk(pieces, tail) {
      const arrows = pieces
        .filter((p) => p.getAttribute('data-dsh-part') === 'arrow')
        .map(geometry);
      assert.equal(arrows.length, 2);
      const tangent = minus(tail.b, tail.c ?? tail.a);
      const sides = arrows.map((wing) => {
        assert.ok(gap(wing.b, tail.b) < eps);
        const v = minus(wing.a, tail.b);
        assert.ok(dot(v, tangent) < 0, id + ' backward arrow');
        return Math.sign(cross(tangent, v));
      });
      assert.equal(sides[0] * sides[1], -1, id + ' arrow wings on the same side');
      assert.ok(Math.abs(boundary(bodies.get(to), tail.b)) < eps, id + ' detached target');
      return arrows;
    }
    assert.ok(route.length);
    const head = route[0].a,
      tail = route.at(-1);
    const tips = [],
      all = [...route];
    assert.ok(Math.abs(boundary(bodies.get(from), head)) < eps, id + ' detached source');
    route.forEach((part, i) => {
      assert.ok(gap(part.a, part.b) > eps);
      if (i) assert.ok(gap(part.a, route[i - 1].b) < eps, id + ' broken route');
    });
    if (inputs) {
      const ports = pieces.filter((p) => p.getAttribute('data-dsh-part') === 'port');
      assert.equal(ports.length, inputs.length);
      const bus = pieces.filter((p) => p.getAttribute('data-dsh-part') === 'bus').map(geometry);
      assert.equal(bus.length, Number(ports.length > 1));
      assert.equal(pieces.length, route.length + bus.length + ports.length);
      all.push(...bus);
      const bases = [];
      for (const [i, p] of ports.entries()) {
        const parts = children(p);
        assert.equal(parts.length, 4);
        assert.equal(parts.find((el) => el.tagName === 'text').textContent, inputs[i]);
        const arm = geometry(parts.find((el) => el.getAttribute('data-dsh-part') === 'branch'));
        const bar = bus[0];
        if (bar) {
          const hit = intersection(bar, arm);
          assert.ok(hit && hit !== 'overlap' && gap(hit, arm.a) < eps, id + ' detached branch');
          assert.ok(
            Math.abs(dot(minus(bar.b, bar.a), minus(arm.b, arm.a))) < eps,
            id + ' angled branch',
          );
        }
        assert.ok(
          tips.every((t) => gap(t, arm.b) > eps),
          id + ' duplicate port',
        );
        all.push(arm, ...arrowInk(parts, arm));
        tips.push(arm.b);
        bases.push(arm.a);
      }
      assert.ok(gap(tail.b, midpoint(bases[0], bases.at(-1))) < eps, id + ' detached fork');
      if (bus.length) {
        assert.ok(gap(bus[0].a, bases[0]) < eps && gap(bus[0].b, bases.at(-1)) < eps);
      }
    } else {
      assert.equal(pieces.length, route.length + 2);
      all.push(...arrowInk(pieces, tail));
      tips.push(tail.b);
    }
    const ink = [];
    for (const part of all) flatten(part, ink);
    for (const seg of ink) {
      const steps = Math.max(1, Math.ceil(gap(seg.a, seg.b) / 0.5));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps,
          p = point(seg.a.x + (seg.b.x - seg.a.x) * t, seg.a.y + (seg.b.y - seg.a.y) * t);
        assert.ok(
          p.x >= -eps && p.y >= -eps && p.x <= width + eps && p.y <= height + eps,
          id + ' off canvas',
        );
        for (const [node, body] of bodies) {
          const clearance = node === from || node === to ? -0.02 : 0.02;
          assert.ok(boundary(body, p) >= clearance, id + ' enters ' + node);
        }
      }
    }
    inks.push({
      id,
      ports: [{ node: from, p: head }, ...tips.map((p) => ({ node: to, p }))],
      ink,
    });
  }
  for (let i = 0; i < inks.length; i++)
    for (const other of inks.slice(i + 1)) {
      const edge = inks[i];
      const shared = edge.ports.filter((a) =>
        other.ports.some((b) => a.node === b.node && gap(a.p, b.p) < eps),
      );
      for (const first of edge.ink)
        for (const second of other.ink) {
          const hit = intersection(first, second);
          if (!hit) continue;
          assert.ok(
            hit !== 'overlap' && shared.some((port) => gap(port.p, hit) < 0.02),
            edge.id + ' and ' + other.id + ' intersect: ' + JSON.stringify(hit),
          );
        }
    }
}

for (const [sample, svgName] of [
  ['transformer-reference', 'captions/Transformer.svg'],
  ['release-curves', 'curves/release.svg'],
  ['transformer-qkv', 'qkv/Transformer.svg'],
]) {
  const input = JSON.parse(
    await readFile(new URL('../demo/' + sample + '.json', import.meta.url), 'utf8'),
  );
  const published = await readFile(
    new URL('../../../doc/evidence/dsh/' + svgName, import.meta.url),
    'utf8',
  );
  audit(input, published);
  let regenerated;
  const tools = new SvgTools(
    () =>
      new Phase1EditorSession(
        {
          write: async (_path, svg) => {
            regenerated = svg;
          },
        },
        { quadraticPaths: true },
      ),
  );
  const layout = input.width === undefined ? { ...input, ...layoutFlowchart(input) } : input;
  await tools.createFlowchart({ ...layout, path: 'audit.svg' });
  audit(input, regenerated);
  console.log(
    `${svgName}: ${input.nodes.length} nodes, ${input.edges.length} directed edges. Published and regenerated SVG passed endpoints, arrowheads, clearances and crossing checks.`,
  );
}
