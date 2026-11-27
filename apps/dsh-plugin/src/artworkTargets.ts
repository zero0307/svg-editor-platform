import type { Element } from '@xmldom/xmldom';

const svg = 'http://www.w3.org/2000/svg';
const children = (e: Element) =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (n as Element).namespaceURI === svg,
  );
const get = (e: Element, name: string) => e.getAttribute(name) ?? '';
const invisible = (e: Element) =>
  get(e, 'display') === 'none' ||
  get(e, 'visibility') === 'hidden' ||
  /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(get(e, 'style'));
export function artworkTransform(root: Element, shape: Element) {
  const transforms = [];
  for (let e: Element | null = shape; e && e !== root; e = e.parentNode as Element | null) {
    if (e.namespaceURI !== svg || (e !== shape && e.localName !== 'g') || invisible(e)) return;
    const transform = get(e, 'transform');
    if (transform) {
      if (
        !/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\([\d.,eE+\s-]+\)\s*,?\s*)+$/.test(
          transform,
        )
      )
        return;
      transforms.unshift(transform);
    }
  }
  return transforms.join(' ');
}
function geometry(shape: Element) {
  const kind = shape.localName;
  const keys =
    kind === 'rect'
      ? ['x', 'y', 'width', 'height']
      : kind === 'ellipse'
        ? ['cx', 'cy', 'rx', 'ry']
        : kind === 'circle'
          ? ['cx', 'cy', 'r']
          : [];
  if (!keys.length || invisible(shape)) return;
  const attrs: Record<string, number | string> = {};
  for (const k of keys) {
    const raw = get(shape, k).trim();
    const n = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(n) || (['width', 'height', 'r', 'rx', 'ry'].includes(k) && n <= 0)) return;
    attrs[k] = n;
  }
  for (const k of ['rx', 'ry'])
    if (kind === 'rect' && shape.hasAttribute(k) && Number.isFinite(Number(get(shape, k))))
      attrs[k] = Number(get(shape, k));
  const area =
    kind === 'rect'
      ? Number(attrs.width) * Number(attrs.height)
      : kind === 'circle'
        ? Number(attrs.r) ** 2 * Math.PI
        : Number(attrs.rx) * Number(attrs.ry) * Math.PI;
  return { shape: kind, geometry: attrs, area };
}
const numberOrZero = (s: string) => Number.parseFloat(s) || 0;
const explicitNode = (g: Element) =>
  /^(?:node|step|stage|card|block|module)[-_.:\d]/i.test(get(g, 'id')) ||
  get(g, 'data-role') === 'node' ||
  g.hasAttribute('data-svg-node');

function textRows(group: Element) {
  const rows: { element: Element; value: string; rank: number }[] = [];
  function visit(el: Element, rank: number) {
    if (invisible(el)) return;
    const inner = children(el);
    if (inner.length) {
      if (inner.every((n) => n.localName === 'tspan'))
        for (const child of inner) visit(child, rank);
      return;
    }
    const value = el.textContent?.trim();
    if (value && el.childNodes.length === 1 && el.firstChild?.nodeType === 3)
      rows.push({ element: el, value, rank });
  }
  function ownText(owner: Element, nested: boolean) {
    for (const el of children(owner).filter((n) => n.localName === 'text')) {
      const marked =
        get(el, 'data-dsh-part') === 'title' ||
        /(?:^|[\s_-])(?:title|heading)(?:$|[\s_-])/i.test(get(el, 'class'));
      const rank = marked
        ? 10000
        : numberOrZero(get(el, 'font-size')) +
          (/^[\d\s.-]+$/.test(el.textContent ?? '') ? -1000 : 0);
      visit(el, nested ? rank - 20000 : rank);
    }
    for (const child of children(owner))
      if (child.localName === 'g' && !explicitNode(child) && !invisible(child))
        ownText(child, true);
  }
  ownText(group, false);
  return rows;
}

// Work on a detached XML tree. The original artwork is displayed as a passive image.
// Only numeric shapes and SVG transforms are copied onto the separate hit surface.
export function artworkTargets(root: Element) {
  if (root.localName !== 'svg' || root.namespaceURI !== svg || root.hasAttribute('transform'))
    return [];
  const all = Array.from(root.getElementsByTagName('*'));
  const counts = new Map<string, number>();
  for (const el of [root, ...all])
    if (el.hasAttribute('id')) {
      const id = get(el, 'id');
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  const groups = all.filter(
    (g) =>
      g.namespaceURI === svg &&
      g.localName === 'g' &&
      get(g, 'id') &&
      counts.get(get(g, 'id')) === 1,
  );
  const candidates = groups.flatMap((g) => {
    const id = get(g, 'id');
    const bodies = children(g).flatMap((el) => {
      const hit = geometry(el);
      return hit ? [{ el, ...hit }] : [];
    });
    if (!bodies.length) return [];
    const body = bodies.reduce((best, b) => (b.area >= best.area ? b : best));
    const rows = textRows(g);
    if (!rows.length) return [];
    const transform = artworkTransform(root, body.el);
    if (transform === undefined) return [];
    if (transform) body.geometry.transform = transform;
    const primary = rows.reduce((best, item) => (item.rank > best.rank ? item : best));
    return [
      {
        id,
        title: primary.value,
        label: rows.map((r) => r.value).join('\n'),
        rows,
        textIndex: rows.indexOf(primary) + 1,
        shape: body.shape,
        geometry: body.geometry,
        artwork: true,
        explicit: explicitNode(g),
      },
    ];
  });
  return candidates.some((n) => n.explicit) ? candidates.filter((n) => n.explicit) : candidates;
}
