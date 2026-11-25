import { DOMImplementation, XMLSerializer, type Element } from '@xmldom/xmldom';
import { DomainError, Numbers, SvgDocument, SvgString } from '@svgframe/core';
import type {
  ReadonlyDocument,
  ReadonlyShape,
  ShapeProviderRegistry,
  SvgCodec,
} from '@svgframe/core';
import { parseSvgSyntax } from '../syntax/parseSvgSyntax.js';
import { SvgImportNormalizer } from './SvgImportNormalizer.js';
import { SvgRestorer } from './SvgRestorer.js';
import { decodeXmlEntities } from './XmlEntities.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ROOT_ATTRIBUTES = new Set(['width', 'height', 'viewBox', 'xmlns', 'version']);

/**
 * Strict SVG codec backed by registered providers.
 *
 * `decode` first rejects unsupported documents before any provider dispatch
 * (DTD/entities, xml-stylesheet, root shape, duplicate ids, depth, namespaces,
 * style/event attributes), then normalizes transforms/inherited lengths and only
 * then restores the complete subtree through providers. `encode` keeps the Phase 1
 * bytes: XML declaration, two-space indentation, attribute order, final newline,
 * XML escaping and `\r` normalization.
 */
export class XmlSvgCodec implements SvgCodec {
  constructor(private readonly providers: ShapeProviderRegistry) {}

  decode(source: string): { document: SvgDocument; warnings: readonly string[] } {
    SvgString.validate(source, 'SVG source');
    if (/<!DOCTYPE|<!ENTITY/i.test(source))
      throw new DomainError('unsupported SVG: DTD and entities');
    if (/<\?xml-stylesheet/i.test(source)) throw new DomainError('unsupported SVG: xml-stylesheet');
    const parsed = parseSvgSyntax(source);
    if (!parsed.ok) throw new DomainError('invalid SVG XML');
    const root = parsed.root;
    if (root.tag !== 'svg') throw new DomainError('invalid SVG: root must be <svg>');

    const attributes = Object.fromEntries(
      Object.entries(root.attributes).map(([name, value]) => [
        name,
        decodeXmlEntities(normalizeLineEndings(value)),
      ]),
    );
    const namespace = attributes.xmlns;
    if (namespace !== undefined && namespace !== '' && namespace !== SVG_NAMESPACE)
      throw new DomainError('invalid SVG namespace');
    const width = this.length(attributes.width ?? '800', 'width');
    const height = this.length(attributes.height ?? '600', 'height');
    const viewBox = attributes.viewBox;
    if (viewBox !== undefined) {
      const values = viewBox
        .trim()
        .split(/[\s,]+/)
        .map((value) => Numbers.parse(value, 'viewBox'));
      if (
        values.length !== 4 ||
        values[0] !== 0 ||
        values[1] !== 0 ||
        values[2] !== width ||
        values[3] !== height
      )
        throw new DomainError('unsupported SVG viewBox: expected 0 0 width height');
    }
    for (const name of Object.keys(attributes)) {
      if (ROOT_ATTRIBUTES.has(name) || name.startsWith('xmlns:')) continue;
      throw new DomainError(`unsupported SVG root attribute: ${name}`);
    }
    if (decodeXmlEntities(normalizeLineEndings(root.text)).trim())
      throw new DomainError('unsupported text outside <text>');

    const normalized = new SvgImportNormalizer(root).normalize();
    const document = new SvgDocument(width, height);
    const restorer = new SvgRestorer(this.providers);
    for (const child of normalized.root.children) document.add(restorer.restore(child));
    document.validate();
    return { document, warnings: normalized.warnings };
  }

  encode(document: ReadonlyDocument): string {
    const xml = new DOMImplementation().createDocument(SVG_NAMESPACE, 'svg', null);
    const root = xml.documentElement!;
    root.setAttribute('xmlns', SVG_NAMESPACE);
    root.setAttribute('width', String(document.width));
    root.setAttribute('height', String(document.height));
    root.setAttribute('viewBox', `0 0 ${document.width} ${document.height}`);
    const append = (shape: ReadonlyShape, parent: Element, depth: number): void => {
      const element = xml.createElementNS(SVG_NAMESPACE, shape.tag);
      element.setAttribute('id', shape.id);
      for (const [name, value] of Object.entries(shape.attributes()))
        element.setAttribute(name, value);
      const content = shape.textContent();
      if (content !== null) element.appendChild(xml.createTextNode(content));
      parent.appendChild(xml.createTextNode(`\n${'  '.repeat(depth)}`));
      parent.appendChild(element);
      shape.children().forEach((child) => append(child, element, depth + 1));
      if (shape.children().length)
        element.appendChild(xml.createTextNode(`\n${'  '.repeat(depth)}`));
    };
    document.root.children().forEach((shape) => append(shape, root, 1));
    root.appendChild(xml.createTextNode('\n'));
    const serialized = new XMLSerializer().serializeToString(xml).replace(/\r/g, '&#13;');
    return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`;
  }

  private length(value: string, name: string): number {
    return Numbers.parse(value.replace(/px$/, ''), name);
  }
}

const normalizeLineEndings = (value: string): string => value.replace(/\r\n?/g, '\n');
