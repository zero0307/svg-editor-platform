import type { Element } from '@xmldom/xmldom';
import type { artworkTargets } from './artworkTargets.js';
import type { EdgeTarget } from './edgeTargets.js';
import { shapeRoute, verifyEditStyle, type EditConnectorStyle } from './curveRoute.js';
import { serialize } from './chartDocument.js';
import { artworkBoxes, endpoints } from './artworkEndpoints.js';
import { crosses, routeEdge } from './edgeRouting.js';

type Nodes = ReturnType<typeof artworkTargets>;
// xmldom records the opening quote of each attribute. Patch only numeric geometry
// values so unknown attributes, comments, markers, line endings and styles survive.
function patchGeometry(source: string, el: Element, values: Record<string, string>) {
  const lines = [0, ...Array.from(source.matchAll(/\r\n|\r|\n/g), (m) => m.index + m[0].length)];
  const edits: { start: number; end: number; text: string }[] = [];
  const missing: string[] = [];
  for (const [k, text] of Object.entries(values)) {
    const attr = el.getAttributeNode(k);
    if (!attr) {
      missing.push(' ' + k + '="' + text + '"');
      continue;
    }
    const start = lines[attr.lineNumber! - 1]! + attr.columnNumber! - 1;
    const quote = source[start],
      end = source.indexOf(quote!, start + 1);
    if ((quote !== '"' && quote !== "'") || end < 0)
      throw new RangeError('Unable to locate connector geometry in the source.');
    edits.push({ start: start + 1, end, text });
  }
  if (missing.length) {
    const pos = lines[el.lineNumber! - 1]! + el.columnNumber! - 1;
    const tag = '<' + el.tagName;
    if (!source.startsWith(tag, pos)) throw new RangeError('Unable to locate selected connector.');
    edits.push({ start: pos + tag.length, end: pos + tag.length, text: missing.join('') });
  }
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, start) + text + source.slice(end);
  return source;
}

// Only replace the selected XML element when a straight SVG primitive needs a path.
function asPath(source: string, el: Element, d: string) {
  if (
    Array.from(el.childNodes).some(
      (n) => n.nodeType === 1 && !['title', 'desc'].includes(n.nodeName),
    )
  )
    throw new RangeError('This connector has animated or nested geometry. Keep its element type.');
  const lineStarts = [
    0,
    ...Array.from(source.matchAll(/\r\n|\r|\n/g), (m) => m.index + m[0].length),
  ];
  const start = lineStarts[el.lineNumber! - 1]! + el.columnNumber! - 1;
  if (!source.startsWith('<' + el.tagName, start))
    throw new RangeError('Cannot locate original connector.');
  const tags =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(?:[^<>"']|"[^"]*"|'[^']*')+>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let m = tags.exec(source); m; m = tags.exec(source)) {
    const token = m[0];
    if (token.startsWith('<!') || token.startsWith('<?')) continue;
    if (token.startsWith('</')) depth--;
    else if (!token.endsWith('/>')) depth++;
    if (depth !== 0) continue;
    const path = el.ownerDocument!.createElementNS(
      el.namespaceURI,
      el.prefix ? el.prefix + ':path' : 'path',
    );
    for (const attr of Array.from(el.attributes)) {
      if (!['x1', 'y1', 'x2', 'y2', 'points'].includes(attr.name))
        path.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    }
    for (const child of Array.from(el.childNodes)) path.appendChild(child.cloneNode(true));
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    return source.slice(0, start) + serialize(path) + source.slice(tags.lastIndex);
  }
  throw new RangeError('Cannot locate the end of the selected connector.');
}

export function reconnectArtwork(
  source: string,
  root: Element,
  edge: EdgeTarget,
  nodes: Nodes,
  fromId?: string,
  toId?: string,
  style?: EditConnectorStyle,
) {
  if (
    !edge.reconnectable ||
    nodes.some((n) => n.geometry.transform) ||
    root.hasAttribute('transform')
  )
    throw new RangeError(
      'Automatic reconnection requires an attached end marker and untransformed nodes and connector.',
    );
  const boxes = artworkBoxes(nodes);
  const from = boxes.find((n) => n.id === (fromId ?? edge.from)),
    to = boxes.find((n) => n.id === (toId ?? edge.to));
  if (!from || !to || from === to || (!fromId && !toId && !style))
    throw new RangeError(
      'Specify distinct source and destination node IDs. Inspect the artwork if an existing endpoint is ambiguous.',
    );
  const view = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number) ?? [0, 0, Number(root.getAttribute('width')), Number(root.getAttribute('height'))];
  if (view.length !== 4 || !view.every(Number.isFinite) || view[2]! <= 0 || view[3]! <= 0)
    throw new RangeError('A finite SVG canvas is required.');
  const [x, y, width, height] = view as [number, number, number, number];
  for (const n of boxes) {
    n.x -= x;
    n.y -= y;
  }
  const chart = { path: '', width, height, nodes: boxes, edges: [] };
  const route = routeEdge(chart, from, to, 0.5);
  const [originalStart, originalEnd] = endpoints(edge);
  // Preserve both exact visible attachment points on a pure style edit (including intentional gaps).
  if (style && from.id === edge.from && to.id === edge.to && originalStart && originalEnd) {
    route[0] = { x: originalStart.x - x, y: originalStart.y - y };
    route[route.length - 1] = { x: originalEnd.x - x, y: originalEnd.y - y };
  }
  if (style === 'straight') route.splice(1, route.length - 2);
  const oldGeometry = edge.parts[0]!.geometry.d ?? '';
  const oldCurved = /[QCTSA]/i.test(oldGeometry);
  const requested =
    style === 'straight'
      ? 'angular'
      : (style ?? (oldCurved ? (/[LHV]/i.test(oldGeometry) ? 'rounded' : 'arc') : 'angular'));
  const spans = shapeRoute(route, requested, chart, from, to);
  verifyEditStyle(style, spans.length, spans.filter((s) => s.control).length);
  if (
    spans.some(
      (s) =>
        !s.control &&
        (boxes.some((n) => crosses(s.start, s.end, n)) ||
          [s.start, s.end].some((p) => p.x < 0 || p.y < 0 || p.x > width || p.y > height)),
    )
  )
    throw new RangeError(
      'This line would cross a card or leave the canvas. Choose a different shape or endpoint.',
    );
  const a = spans[0]!.start,
    b = spans.at(-1)!.end;
  const shape = edge.parts[0]!.shape,
    curved = spans.some((s) => s.control);
  const xy = (p: { x: number; y: number }) => p.x + x + ' ' + (p.y + y);
  let values: Record<string, string>, after: string;
  if (shape === 'path' || curved || (shape === 'line' && spans.length !== 1)) {
    const d =
      'M ' +
      xy(a) +
      ' ' +
      spans
        .map(({ control, end }) => (control ? 'Q ' + xy(control) + ' ' + xy(end) : 'L ' + xy(end)))
        .join(' ');
    values = { d };
    if (shape === 'path') {
      // A formerly straight, unfilled-looking path can default to black fill when bowed.
      if (curved) {
        let fill = '';
        for (let e: Element | null = edge.element; e?.nodeType === 1; e = e.parentNode as Element)
          if (e.hasAttribute('fill')) {
            fill = e.getAttribute('fill')!;
            break;
          }
        if (fill !== 'none') values.fill = 'none';
      }
      after = patchGeometry(source, edge.element, values);
    } else after = asPath(source, edge.element, d);
  } else {
    values =
      shape === 'line'
        ? { x1: String(a.x + x), y1: String(a.y + y), x2: String(b.x + x), y2: String(b.y + y) }
        : {
            points: [a, ...spans.map((s) => s.end)].map((p) => p.x + x + ',' + (p.y + y)).join(' '),
          };
    after = patchGeometry(source, edge.element, values);
  }
  return { source: after, from: from.id, to: to.id, values };
}
