import type { Element } from '@xmldom/xmldom';
import { fontSize, wrapLabel } from './chartText.js';
import type { ChartNode } from './flowchart.js';

// Edit the original XML span so declarations, entity spellings and every other node survive.
export function renameLine(
  source: string,
  group: Element,
  node: ChartNode,
  line: number,
  label: string,
) {
  const parts = node.label.split(/(\r\n|\r|\n)/);
  if (!Number.isInteger(line) || line < 1 || line > (parts.length + 1) / 2 || /[\r\n]/.test(label))
    throw new RangeError('Choose one existing logical line and a single-line replacement.');
  const rows: Element[][] = [];
  for (const child of Array.from(group.getElementsByTagName('text'))) {
    if (child.parentNode !== group) continue;
    if (child.getAttribute('id') === node.id + '-label') rows.push([child]);
    else if (child.getAttribute('data-dsh-part') === 'label-continuation') {
      if (['crlf', 'cr', 'lf'].includes(child.getAttribute('data-dsh-break') ?? ''))
        rows.push([child]);
      else rows.at(-1)?.push(child);
    }
  }
  const row = rows[line - 1];
  const element = row?.[0];
  const text = element?.firstChild;
  const size = Number(element?.getAttribute('font-size'));
  if (
    !element ||
    row?.length !== 1 ||
    !text ||
    text.nodeType !== 3 ||
    element.childNodes.length !== 1 ||
    !text.lineNumber ||
    !text.columnNumber ||
    !size ||
    text.nodeValue !== parts[(line - 1) * 2]
  )
    throw new RangeError(
      'This line cannot be edited losslessly. Supply the full label to reflow it.',
    );
  const available = node.width - Math.min(32, node.width * 0.2);
  if ((wrapLabel(label, Infinity)[0]!.width * size) / fontSize > available)
    throw new RangeError(
      'The replacement needs reflow. Supply the full label to fit it to the node.',
    );
  const starts = [0, ...Array.from(source.matchAll(/\r\n|\r|\n/g), (m) => m.index + m[0].length)];
  const offset = starts[text.lineNumber - 1]! + text.columnNumber - 1;
  const end = source.indexOf('<', offset);
  if (source[offset - 1] !== '>' || end < offset || !source.startsWith('</' + element.tagName, end))
    throw new RangeError('Unable to locate the original text safely.');
  const escaped = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  parts[(line - 1) * 2] = label;
  return { source: source.slice(0, offset) + escaped + source.slice(end), label: parts.join('') };
}
