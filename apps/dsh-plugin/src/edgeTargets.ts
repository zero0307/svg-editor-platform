import type { Element } from '@xmldom/xmldom';
import { artworkBoxes, nearbyEnds } from './artworkEndpoints.js';
import { artworkTransform } from './artworkTargets.js';

const coordinates: Record<string, string[]> = {
  line: ['x1', 'y1', 'x2', 'y2'],
  path: ['d'],
  polyline: ['points'],
};
const namedEdges = /(?:^|[-_ ])(?:edges?|connectors?|connections?|links?)(?:$|[-_ ])/i;
const decoration =
  /(?:^|[-_ ])(?:legend|header|footer|background|icon|arrowheads?|labels?)(?:$|[-_ ])/i;
type Part = { shape: string; geometry: Record<string, string> };
export interface EdgeTarget {
  id: string;
  title: string;
  parts: Part[];
  element: Element;
  artwork: boolean;
  from?: string;
  to?: string;
  originalGeometry?: string;
  reconnectable?: boolean;
}

export function edgeTargets(
  root: Element,
  nodes: Parameters<typeof artworkBoxes>[0],
): EdgeTarget[] {
  const titles = new Map(nodes.map((n) => [n.id, n.title]));
  const all = Array.from(root.getElementsByTagName('*'));
  const counts = new Map<string, number>();
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const result: EdgeTarget[] = [],
    groups = new Map<Element, EdgeTarget>();
  for (const [index, el] of all.entries()) {
    const shape = el.localName;
    if (!shape) continue;
    const keys = coordinates[shape];
    if (!Array.isArray(keys)) continue;
    const transform = artworkTransform(root, el);
    if (transform === undefined) continue;
    const geometry: Record<string, string> = {};
    for (const key of keys)
      geometry[key] = el.getAttribute(key) ?? (el.localName === 'line' ? '0' : '');
    if (transform) geometry.transform = transform;
    const part = { shape, geometry };
    let owner: Element | undefined,
      layer = false,
      skip = false,
      marker = '';
    for (let e: Element | null = el; e && e !== root; e = e.parentNode as Element) {
      const id = e.getAttribute('id') ?? '';
      if (titles.has(id) || decoration.test(id) || e.getAttribute('data-dsh-role') === 'node')
        skip = true;
      if (e.getAttribute('data-dsh-role') === 'edge') {
        owner = e;
        break;
      }
      if (namedEdges.test(id) || e.getAttribute('data-role') === 'edge') layer = true;
      marker ||= e.getAttribute('marker-end') ?? '';
    }
    if (skip) continue;
    if (owner) {
      const id = owner.getAttribute('id'),
        from = owner.getAttribute('data-dsh-from'),
        to = owner.getAttribute('data-dsh-to');
      if (!id || counts.get(id) !== 1 || !from || !to) continue;
      let edge = groups.get(owner);
      if (!edge) {
        edge = {
          id,
          title: (titles.get(from) ?? from) + ' → ' + (titles.get(to) ?? to),
          from,
          to,
          parts: [],
          element: owner,
          artwork: false,
        };
        groups.set(owner, edge);
        result.push(edge);
      }
      edge.parts.push(part);
      continue;
    }
    const boundArrow = /^url\(\s*['"]?#[^()'"\s]+['"]?\s*\)$/.test(marker);
    if (!boundArrow && !layer) continue;
    const id = el.getAttribute('id');
    // Outline-only paths in a connector layer can have separate arrowheads. Offer picking
    // without moving them as if they were a self-contained, attached SVG marker.
    const address = id && counts.get(id) === 1 ? 'id:' + id : 'at:' + index;
    result.push({
      id: address,
      title: id || '连线 ' + (result.length + 1),
      parts: [part],
      element: el,
      artwork: true,
      originalGeometry: JSON.stringify([part.shape, geometry, marker]),
      reconnectable: boundArrow && !transform,
    });
  }
  const boxes = artworkBoxes(nodes);
  for (const edge of result)
    if (edge.artwork) {
      Object.assign(edge, nearbyEnds(edge, boxes));
      edge.reconnectable &&= boxes.length === nodes.length && !root.hasAttribute('transform');
      if (edge.from && edge.to) edge.title = titles.get(edge.from) + ' → ' + titles.get(edge.to);
    }
  return result;
}
