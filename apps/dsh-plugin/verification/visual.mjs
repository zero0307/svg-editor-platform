// Check actual glyph pixels, including font substitution on each CI OS.
import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';
import { SvgTools } from '../dist/src/SvgTools.js';
import { layoutFlowchart } from '../dist/src/layoutFlowchart.js';
import { Phase1EditorSession } from '../dist/src/session.cjs';

const font =
  { darwin: 'PingFang SC', win32: 'Microsoft YaHei', linux: 'DejaVu Sans' }[process.platform] ??
  'sans-serif';
const labels = [
  'QA 核对数据保留策略与隐私合规要求',
  'W'.repeat(35) + ' CAFE\u0301',
  '设计 👨‍👩‍👧‍👦 Design\n签核 Sign off',
];
const graph = { nodes: labels.map((label, i) => ({ id: 'n' + i, label })), edges: [] };
const layout = layoutFlowchart(graph);
const manual = {
  id: 'manual',
  label: 'Manual QA 排版',
  x: 30,
  y: layout.height,
  width: 72,
  height: 27,
};
const nodes = [...layout.nodes, manual];
let svg;
const tools = new SvgTools(
  () =>
    new Phase1EditorSession({
      write: async (_path, text) => {
        svg = text;
      },
    }),
);
for (const theme of ['studio', 'print']) {
  await tools.createFlowchart({
    ...layout,
    height: layout.height + 45,
    nodes,
    theme,
    path: 'sample.svg',
  });
  // The second image differs only in the generated text elements. Each changed pixel is glyph ink.
  const blank = svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, '');
  for (const zoom of [1, 2]) {
    const options = {
      fitTo: { mode: 'zoom', value: zoom },
      background: 'white',
      font: { loadSystemFonts: true, defaultFontFamily: font, sansSerifFamily: font },
    };
    const reference = new Resvg(blank, options).render().pixels;
    const image = new Resvg(svg, options).render();
    const ink = image.pixels;
    const counts = nodes.map(() => 0);
    for (let i = 0; i < ink.length; i += 4) {
      if (
        ink[i] === reference[i] &&
        ink[i + 1] === reference[i + 1] &&
        ink[i + 2] === reference[i + 2]
      )
        continue;
      const x = (((i / 4) % image.width) + 0.5) / zoom,
        y = (Math.floor(i / 4 / image.width) + 0.5) / zoom;
      const index = nodes.findIndex(
        (n) => x >= n.x + 2 && x <= n.x + n.width - 2 && y >= n.y + 2 && y <= n.y + n.height - 2,
      );
      assert.ok(index >= 0, `Text crosses node inset at ${x},${y} in ${theme} at ${zoom}x`);
      counts[index]++;
    }
    assert.ok(
      counts.every((n) => n >= 25),
      'Every label must produce visible glyphs',
    );
    console.log(`DSH ${theme} ${zoom}x: all four labels render inside their boxes.`);
  }
}
