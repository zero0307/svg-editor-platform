// Rasterize isolated layers: hidden glyphs still exist in the caption mask.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { DOMParser } from '@xmldom/xmldom';
import { SvgTools } from '../dist/src/SvgTools.js';
import { Phase1EditorSession } from '../dist/src/session.cjs';

const evidence = new URL('../../../doc/evidence/dsh/', import.meta.url);
const input = JSON.parse(
  await readFile(new URL('../demo/transformer-reference.json', import.meta.url)),
);
const old = await readFile(new URL('curves/Transformer.svg', evidence), 'utf8');
const published = await readFile(new URL('captions/Transformer.svg', evidence), 'utf8');
const font =
  { darwin: 'PingFang SC', win32: 'Microsoft YaHei', linux: 'DejaVu Sans' }[process.platform] ??
  'sans-serif';

function audit(svg, zoom, only, clearance = 3) {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const children = Array.from(root.childNodes).filter((n) => n.nodeType === 1);
  const width = Number(root.getAttribute('width')),
    height = Number(root.getAttribute('height'));
  function raster(elements) {
    const layer =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      width +
      '" height="' +
      height +
      '">' +
      elements.join('') +
      '</svg>';
    return new Resvg(layer, {
      fitTo: { mode: 'zoom', value: zoom },
      font: { loadSystemFonts: true, defaultFontFamily: font, sansSerifFamily: font },
    }).render().pixels;
  }
  const portLabels = [];
  for (const g of Array.from(root.getElementsByTagName('g'))) {
    if (g.getAttribute('data-dsh-part') !== 'port') continue;
    const label = g.getElementsByTagName('text').item(0);
    assert.ok(label);
    portLabels.push(g.removeChild(label));
  }
  const foreground = raster(
    children.filter((el) => ['node', 'edge'].includes(el.getAttribute('data-dsh-role'))),
  );
  const captions = [...children, ...portLabels].filter(
    (el) => el.tagName === 'text' && (!only || el.getAttribute('id') === only),
  );
  assert.ok(captions.length);
  let overlaps = 0,
    close = 0,
    ink = 0;
  const stride = width * zoom,
    radius = clearance * zoom;
  for (const caption of captions) {
    const pixels = raster([caption]);
    const previouslyClose = close;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 20) continue;
      ink++;
      if (foreground[i] >= 20) overlaps++;
      const p = (i - 3) / 4,
        x = p % stride,
        y = Math.floor(p / stride);
      let hit = false;
      for (let dy = -radius; !hit && dy <= radius; dy++) {
        if (y + dy < 0 || y + dy >= height * zoom) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          if (x + dx >= 0 && x + dx < stride && foreground[i + 4 * (dy * stride + dx)] >= 20) {
            hit = true;
            break;
          }
        }
      }
      if (hit) close++;
    }
    if (clearance && close > previouslyClose)
      console.log(
        caption.getAttribute('id'),
        close - previouslyClose,
        'glyph pixels within clearance at',
        zoom + 'x',
      );
    // Other captions are also obstacles, independently of their paint order.
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] >= 20) foreground[i] = 255;
  }
  assert.ok(ink > 20, 'Expected visible caption ink in isolated layer');
  return { overlaps, close, captions: captions.length };
}

const decoder = 'dsh-panel-2-heading';
const before = audit(old, 2, decoder, 0);
console.log('Original decoder heading overlap at 2x:', before.overlaps, 'pixels');
if (process.platform === 'darwin') assert.ok(before.overlaps > 0);
// Use Latin glyphs as a portable positive control when system CJK fonts differ.
const broken = new DOMParser().parseFromString(published, 'image/svg+xml');
const heading = broken.getElementById(decoder);
heading.setAttribute('x', '455');
heading.setAttribute('y', '278');
heading.textContent = 'TEST';
assert.ok(
  audit(broken.toString(), 1, decoder, 0).overlaps > 0,
  'The audit must detect covered letters',
);

let generated;
const tools = new SvgTools(
  () =>
    new Phase1EditorSession(
      {
        write: async (_path, svg) => {
          generated = svg;
        },
      },
      { quadraticPaths: true },
    ),
);
for (const theme of ['studio', 'print']) {
  await tools.createFlowchart({ ...input, theme, path: 'reference.svg' });
  if (theme === 'studio')
    assert.equal(generated, published, 'The shipped SVG must match the generator');
  for (const zoom of [1, 2]) {
    const report = audit(generated, zoom);
    assert.deepEqual(report, { overlaps: 0, close: 0, captions: 6 }, theme + ' ' + zoom + 'x');
    console.log(
      'Transformer ' +
        theme +
        ' ' +
        zoom +
        'x: six captions clear of nodes, connectors and other captions (3 SVG units).',
    );
  }
}
// Recreate the original tight decoder panel. Force the plugin to find a different placement.
const dense = {
  ...input,
  panels: input.panels.map((p, i) => (i === 1 ? { ...p, y: 235, height: 386 } : p)),
  nodes: input.nodes.map((n) =>
    ['linear', 'softmax', 'probs'].includes(n.id) ? { ...n, y: n.y + 20 } : n,
  ),
};
await tools.createFlowchart({ ...dense, path: 'original-layout.svg' });
assert.deepEqual(audit(generated, 2), { overlaps: 0, close: 0, captions: 6 });
console.log('Original tight layout also passes at 2x.');

const qkvInput = JSON.parse(
  await readFile(new URL('../demo/transformer-qkv.json', import.meta.url)),
);
const qkvSvg = await readFile(new URL('qkv/Transformer.svg', evidence), 'utf8');
for (const theme of ['studio', 'print']) {
  await tools.createFlowchart({ ...qkvInput, theme, path: 'qkv.svg' });
  if (theme === 'studio') assert.equal(generated, qkvSvg);
  for (const zoom of [1, 2]) {
    const result = audit(generated, zoom);
    assert.deepEqual(result, { overlaps: 0, close: 0, captions: 15 }, theme + ' ' + zoom + 'x QKV');
    console.log(
      'QKV ' +
        theme +
        ' ' +
        zoom +
        'x: all nine port labels and six captions passed the ink check.',
    );
  }
}

for (const [name, count] of [
  ['Transformer', 17],
  ['cross-attention', 4],
  ['editorial', 1],
]) {
  const svg = await readFile(new URL('presentation/' + name + '.svg', evidence), 'utf8');
  for (const zoom of [1, 2]) {
    const report = audit(svg, zoom);
    assert.deepEqual(report, { overlaps: 0, close: 0, captions: count });
    console.log(
      'Presentation ' + name + ' ' + zoom + 'x: ' + count + ' captions and port labels clear.',
    );
  }
}
