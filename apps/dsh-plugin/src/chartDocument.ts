import type { Element } from '@xmldom/xmldom';
import type { FileStore } from '@svgframe/core';
import { DOMParser, XMLSerializer } from './xml.cjs';
import { Phase1EditorSession } from './session.cjs';
import { readFlowchart } from './readFlowchart.js';
import type { ChartNode } from './flowchart.js';

export const elements = (e: Element) => Array.from(e.getElementsByTagName('*'));
export const serialize = (e: Element) => new XMLSerializer().serializeToString(e);
export function parseSvg(raw: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new RangeError('Unsupported SVG document type.');
  const document = new DOMParser({
    onError: (_level, message) => {
      throw new Error(message);
    },
  }).parseFromString(raw, 'application/xml');
  const root = document.documentElement;
  if (!root || root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg')
    throw new RangeError('Expected an SVG document.');
  return root;
}
export function memorySession(initial: string) {
  let contents = initial;
  const files: FileStore = {
    read: async () => contents,
    write: async (_path, value) => {
      contents = value;
    },
  };
  return {
    session: () => new Phase1EditorSession(files, { quadraticPaths: true }),
    contents: () => contents,
  };
}
export async function nativeGraph(raw: string) {
  const { document, warnings } = await memorySession(raw).session().read('chart.svg');
  return { graph: readFlowchart(document), warnings };
}
export function bodyOf(group: Element) {
  return Array.from(group.childNodes).find(
    (e): e is Element => e.nodeType === 1 && ['rect', 'ellipse'].includes(e.nodeName),
  );
}
export function chartNode(group: Element, label: string): ChartNode {
  const body = bodyOf(group);
  if (!body) throw new RangeError('Missing node body: ' + group.getAttribute('id'));
  const n = (k: string) => Number(body.getAttribute(k));
  const oval = body.localName === 'ellipse';
  return {
    id: group.getAttribute('id')!,
    label,
    shape: oval ? 'ellipse' : 'box',
    x: oval ? n('cx') - n('rx') : n('x'),
    y: oval ? n('cy') - n('ry') : n('y'),
    width: oval ? 2 * n('rx') : n('width'),
    height: oval ? 2 * n('ry') : n('height'),
  };
}
