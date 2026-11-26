// Compare the untreated image and the separate, transparent click surface at two zoom levels.
// Then check the actual changed pixels after editing one label in the unconverted source.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { parseSvg } from '../dist/src/chartDocument.js';
import { artworkTargets } from '../dist/src/artworkTargets.js';
import { edgeTargets } from '../dist/src/edgeTargets.js';
import { artwork } from '../dist/src/artwork.js';
const font =
  { darwin: 'PingFang SC', win32: 'Microsoft YaHei', linux: 'DejaVu Sans' }[process.platform] ??
  'sans-serif';
const cases = [
  ['review', 'node-fact-check'],
  ['ports', 'node-encoder'],
  ['pipeline', 'step-2'],
];
for (const [sample, id] of cases) {
  const raw = await readFile(
    new URL(
      '../../../doc/evidence/dsh/presentation/trials/' + sample + '-without.svg',
      import.meta.url,
    ),
    'utf8',
  );
  const root = parseSvg(raw),
    nodes = artworkTargets(root),
    target = nodes.find((n) => n.id === id);
  const width = Number(root.getAttribute('width')),
    height = Number(root.getAttribute('height'));
  const files = new Map([['in.svg', raw]]),
    store = {
      read: async (k) => files.get(k),
      write: async (k, v) => {
        files.set(k, v);
      },
    };
  await artwork(store, {
    path: 'in.svg',
    output: 'out.svg',
    operation: 'rename',
    nodeId: id,
    textIndex: target.textIndex,
    originalText: target.title,
    label: 'QA OK',
  });
  const edgeOverlay = edgeTargets(root, nodes)
    .flatMap((edge) => edge.parts)
    .map(({ shape, geometry }) => {
      const layer = root.ownerDocument.createElementNS(root.namespaceURI, shape);
      for (const [key, value] of Object.entries(geometry)) layer.setAttribute(key, value);
      layer.setAttribute('fill', 'none');
      layer.setAttribute('stroke', 'transparent');
      layer.setAttribute('stroke-width', '14');
      return layer.toString();
    })
    .join('');
  const active =
    edgeOverlay +
    nodes
      .map(
        (n) =>
          '<' +
          n.shape +
          ' ' +
          Object.entries(n.geometry)
            .map(([k, v]) => k + '="' + v + '"')
            .join(' ') +
          ' fill="transparent" stroke="none"/>',
      )
      .join('');
  const wrapper = (overlay) =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '"><image width="' +
    width +
    '" height="' +
    height +
    '" href="data:image/svg+xml;base64,' +
    Buffer.from(raw).toString('base64') +
    '"/>' +
    overlay +
    '</svg>';
  for (const zoom of [1, 2]) {
    const render = (svg) =>
      new Resvg(svg, {
        fitTo: { mode: 'zoom', value: zoom },
        font: { defaultFontFamily: font, sansSerifFamily: font },
      }).render().pixels;
    const off = render(wrapper('')),
      on = render(wrapper(active));
    assert.ok(off.some((v, i) => i % 4 === 3 && v > 0));
    assert.equal(Buffer.compare(off, on), 0, sample + ' unchanged before selection');
    const before = render(raw),
      after = render(files.get('out.svg'));
    const box = target.geometry;
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (before.readUInt32LE(i) === after.readUInt32LE(i)) continue;
      const x = ((i / 4) % (width * zoom)) / zoom,
        y = Math.floor(i / 4 / (width * zoom)) / zoom;
      assert.ok(
        x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height,
        sample + ' changed outside selected card',
      );
      changed++;
    }
    assert.ok(changed > 0);
    console.log(
      sample +
        ' ' +
        zoom +
        'x: ' +
        nodes.length +
        ' targets, 0 changed pixels on enable; ' +
        changed +
        ' changed after rename, 0 outside selected card.',
    );
  }
}
