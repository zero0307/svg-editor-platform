import type { EditorSessionPort } from '@svgframe/core';
import type { Chart } from './flowchart.js';
import { fontSize, wrapLabel } from './chartText.js';

// Panels are presentation elements behind the graph. Their outlines do not block connectors.
export function drawPanels(
  session: EditorSessionPort,
  chart: Chart,
  id: (preferred: string) => string,
) {
  const print = chart.theme === 'print';
  const ink = print ? '#292929' : '#193B50';
  const family = 'Inter, PingFang SC, Microsoft YaHei, sans-serif';
  function text(
    name: string,
    label: string,
    x: number,
    baseline: number,
    size: number,
    weight: string,
    align: 'start' | 'end' = 'start',
  ) {
    session.create({
      id: id(name),
      type: 'text',
      args: [String(x), String(baseline), label],
      presentation: {
        fill: ink,
        'font-family': family,
        'font-size': String(size),
        'font-weight': weight,
        'text-anchor': align,
      },
    });
  }
  function heading(
    name: string,
    label: string,
    x: number,
    y: number,
    width: number,
    size: number,
    align: 'start' | 'end' = 'start',
  ) {
    if (!label.trim() || /[\r\n]/.test(label))
      throw new RangeError('Title and panel headings must fit on a single line.');
    const measured = wrapLabel(label, Infinity)[0]!.width;
    text(
      name,
      label,
      x,
      y,
      Math.min(size, (fontSize * width) / Math.max(measured, 1)),
      '700',
      align,
    );
  }
  if (chart.title !== undefined) {
    if (chart.width <= 56 || chart.height <= 52)
      throw new RangeError('Allow space at the top of the canvas for the title.');
    heading('dsh-title', chart.title, 28, 46, chart.width - 56, 32);
  }
  for (const [i, panel] of (chart.panels ?? []).entries()) {
    const { x, y, width, height, label, description } = panel;
    if (
      ![x, y, width, height].every(Number.isFinite) ||
      x < 0 ||
      y < 0 ||
      width < 40 ||
      height < 40 ||
      x + width > chart.width ||
      y + height > chart.height
    )
      throw new RangeError('Panel must fit within the canvas: ' + label);
    if (panel.tone && !['normal', 'accent', 'muted', 'strong'].includes(panel.tone))
      throw new RangeError('Unknown panel tone.');
    const fill = print
      ? '#FAFAFA'
      : panel.tone === 'accent'
        ? '#F0F7F5'
        : panel.tone === 'muted'
          ? '#FBF7EE'
          : panel.tone === 'strong'
            ? '#E1EAF0'
            : '#F2F6FA';
    const stroke = print
      ? '#888888'
      : panel.tone === 'accent'
        ? '#BED8D1'
        : panel.tone === 'muted'
          ? '#DFD0AF'
          : '#BDCDD9';
    const key = 'dsh-panel-' + (i + 1);
    session.create({
      id: id(key),
      type: 'rect',
      args: [x, y, width, height].map(String).concat(fill),
      presentation: { rx: '14', stroke, 'stroke-width': '1' },
    });
    heading(
      key + '-heading',
      label,
      panel.headingAlign === 'end' ? x + width - 16 : x + 16,
      y + 27,
      width - 32,
      17,
      panel.headingAlign,
    );
    if (description) {
      const lines = wrapLabel(description, width - 32);
      if (
        49 + (lines.length - 1) * 20 + 6 > height ||
        lines.some((line) => line.width > width - 32)
      )
        throw new RangeError('Allow more space for panel text: ' + label);
      lines.forEach((line, j) =>
        text(key + '-note-' + j, line.text, x + 16, y + 49 + j * 20, 14, '400'),
      );
    }
  }
}
