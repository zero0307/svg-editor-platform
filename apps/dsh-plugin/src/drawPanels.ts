import type { EditorSessionPort } from '@svgframe/core';
import type { Bounds } from './edgeRouting.js';
import type { Span } from './curveRoute.js';
import { placeCaption } from './placeCaption.js';
import type { Chart } from './flowchart.js';
import { fontSize, wrapLabel } from './chartText.js';

// Panels are presentation elements behind the graph. Their outlines do not block connectors.
export function drawPanels(
  session: EditorSessionPort,
  chart: Chart,
  id: (preferred: string) => string,
) {
  if (chart.title === undefined && !chart.panels?.length) return;
  const spans: Span[] = [];
  const occupied: Bounds[] = [...chart.nodes];
  const captions: (() => void)[] = [];
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
    area: Bounds,
    inset: number,
    baseline: number,
    requestedSize: number,
    align: 'start' | 'end' = 'start',
    description?: string,
  ) {
    if (!label.trim() || /[\r\n]/.test(label))
      throw new RangeError('Title and panel headings must fit on a single line.');
    const available = area.width - inset * 2;
    const measured = wrapLabel(label, Infinity)[0]!.width;
    const size = Math.min(requestedSize, (fontSize * available) / Math.max(measured, 1));
    const notes = description ? wrapLabel(description, available) : [];
    const noteWidth = notes.reduce((w, line) => Math.max(w, (line.width * 14) / fontSize), 0);
    const belowBaseline = (s: number) =>
      notes.length ? 22 + (notes.length - 1) * 20 + 4 : s * 0.3;
    if (noteWidth > available || baseline + belowBaseline(size) + 2 > area.height)
      throw new RangeError('Allow more space for panel text: ' + label);
    captions.push(() => {
      const variants = [{ size, inset }];
      // Preserve a one-line heading on older, tightly packed manual layouts.
      if (requestedSize === 17 && size > 13 && !notes.length) variants.push({ size: 13, inset: 7 });
      for (const variant of variants) {
        const width = Math.max((measured * variant.size) / fontSize, noteWidth);
        const box = placeCaption(
          area,
          { ...variant, align, baseline, width, belowBaseline: belowBaseline(variant.size) },
          occupied,
          spans,
        );
        if (!box) continue;
        occupied.push(box);
        const y = box.y + variant.size;
        text(name, label, align === 'end' ? box.x + width : box.x, y, variant.size, '700', align);
        notes.forEach((line, j) =>
          text(
            name.replace(/-heading$/, '') + '-note-' + j,
            line.text,
            box.x,
            y + 22 + j * 20,
            14,
            '400',
          ),
        );
        return;
      }
      throw new RangeError('Allow more clear space near the top for the caption: ' + label);
    });
  }
  if (chart.title !== undefined) {
    if (chart.width <= 56 || chart.height <= 52)
      throw new RangeError('Allow space at the top of the canvas for the title.');
    heading(
      'dsh-title',
      chart.title,
      { x: 0, y: 0, width: chart.width, height: chart.height },
      28,
      46,
      32,
    );
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
    heading(key + '-heading', label, panel, 16, 27, 17, panel.headingAlign, description);
  }
  return { spans, occupied, render: () => captions.forEach((place) => place()) };
}
