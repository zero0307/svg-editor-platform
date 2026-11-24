import type { Element } from '@xmldom/xmldom';
import type { ChartNode } from './flowchart.js';
import { elements, parseSvg } from './chartDocument.js';
export function changePreview(
  before: string,
  after: string,
  nodes: ChartNode[],
  removed: Element[],
  added: Element[],
) {
  const x = nodes.flatMap((n) => [n.x, n.x + n.width]),
    y = nodes.flatMap((n) => [n.y, n.y + n.height]);
  for (const group of [...removed, ...added])
    for (const e of elements(group)) {
      if (e.localName === 'line') {
        x.push(Number(e.getAttribute('x1')), Number(e.getAttribute('x2')));
        y.push(Number(e.getAttribute('y1')), Number(e.getAttribute('y2')));
      }
      if (e.localName === 'path') {
        const nums =
          e
            .getAttribute('d')
            ?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)
            ?.map(Number) ?? [];
        for (let i = 0; i + 1 < nums.length; i += 2) {
          x.push(nums[i]!);
          y.push(nums[i + 1]!);
        }
      }
    }
  const view = [
    Math.min(...x) - 20,
    Math.min(...y) - 20,
    Math.max(...x) - Math.min(...x) + 40,
    Math.max(...y) - Math.min(...y) + 40,
  ];
  const root = parseSvg(before);
  const w = Number(root.getAttribute('width')),
    h = Number(root.getAttribute('height'));
  const panels = [before, after].map((source, i) => {
    const data = Buffer.from(source).toString('base64');
    return (
      '<text x="' +
      (i * 600 + 20) +
      '" y="32" font-size="20">' +
      (i ? '修改后' : '修改前') +
      '</text><svg x="' +
      (i * 600 + 8) +
      '" y="48" width="584" height="300" viewBox="' +
      view.join(' ') +
      '"><image width="' +
      w +
      '" height="' +
      h +
      '" href="data:image/svg+xml;base64,' +
      data +
      '"/></svg>'
    );
  });
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360"><rect width="1200" height="360" fill="white"/>' +
    panels.join('') +
    '</svg>'
  );
}
