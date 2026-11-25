import { DomainError } from '@svgframe/core';
import type { SvgElementView } from '@svgframe/core';
import type { SvgSyntaxElement } from '../syntax/SvgSyntaxElement.js';
import { SvgImportContext } from './SvgImportContext.js';
import { decodeXmlEntities } from './XmlEntities.js';

/** Attribute names the Phase 1 geometry classes scale themselves. */
const geometryByTag: Readonly<Record<string, readonly string[]>> = {
  rect: ['x', 'y', 'width', 'height'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  text: ['x', 'y'],
  g: [],
};

export interface NormalizedSvg {
  readonly root: SvgElementView;
  readonly warnings: readonly string[];
}

/**
 * Turns the neutral syntax tree into provider-ready `SvgElementView` nodes.
 *
 * Order is significant and mirrors the Phase 1 importer: global duplicate-ID and
 * depth checks run before any provider selection or degradation, then missing ids
 * are assigned with the Phase 1 per-tag counters and warning text, then inherited
 * lengths/world transforms are normalized and every element's scaled
 * length-sensitive attributes are validated once. Provider restore itself happens
 * afterwards; this class never imports a concrete shape provider.
 */
export class SvgImportNormalizer {
  private readonly ids = new Map<SvgSyntaxElement, string>();
  private readonly used = new Set<string>();
  private readonly counters = new Map<string, number>();
  private readonly warnings: string[] = [];

  constructor(private readonly root: SvgSyntaxElement) {}

  normalize(): NormalizedSvg {
    this.precheckDuplicates(this.root.children, 1);
    this.precheckAttributes(this.root.children);
    this.assignIdentifiers(this.root.children);
    const children = this.root.children.map((child) =>
      this.view(child, SvgImportContext.root(), 1),
    );
    return {
      root: {
        tag: 'svg',
        id: null,
        attributes: {},
        text: null,
        children,
        transform: { scale: 1, translateX: 0, translateY: 0 },
      },
      warnings: this.warnings,
    };
  }

  private precheckDuplicates(elements: readonly SvgSyntaxElement[], depth: number): void {
    if (depth > 128) throw new DomainError('SVG nesting exceeds 128 levels');
    for (const element of elements) {
      const id = explicitId(element);
      if (id) {
        if (this.used.has(id)) throw new DomainError(`id already exists: ${id}`);
        this.used.add(id);
      }
      this.precheckDuplicates(element.children, depth + 1);
    }
  }

  private precheckAttributes(elements: readonly SvgSyntaxElement[]): void {
    for (const element of elements) {
      if (element.tag.includes(':')) throw new DomainError('unsupported SVG namespace');
      const namespace = element.attributes.xmlns;
      if (namespace !== undefined && namespace !== '' && namespace !== 'http://www.w3.org/2000/svg')
        throw new DomainError('unsupported SVG namespace');
      for (const name of Object.keys(element.attributes)) {
        if (name === 'style' || /^on/i.test(name))
          throw new DomainError(`unsupported SVG attribute: ${name}`);
        const colon = name.indexOf(':');
        if (colon > 0) {
          const prefix = name.slice(0, colon);
          if (prefix !== 'xml' && prefix !== 'xmlns')
            throw new DomainError(`unsupported SVG attribute namespace: ${prefix}`);
        }
      }
      this.precheckAttributes(element.children);
    }
  }

  private assignIdentifiers(elements: readonly SvgSyntaxElement[]): void {
    for (const element of elements) {
      const explicit = explicitId(element);
      if (explicit) {
        this.ids.set(element, explicit);
      } else {
        let number = this.counters.get(element.tag) ?? 1;
        while (this.used.has(`${element.tag}${number}`)) number++;
        const id = `${element.tag}${number}`;
        this.counters.set(element.tag, number + 1);
        this.used.add(id);
        this.ids.set(element, id);
        this.warnings.push(`warning: assigned id ${id} to unnamed <${element.tag}>`);
      }
      this.assignIdentifiers(element.children);
    }
  }

  private view(element: SvgSyntaxElement, parent: SvgImportContext, depth: number): SvgElementView {
    if (depth > 128) throw new DomainError('SVG nesting exceeds 128 levels');
    const attributes = Object.fromEntries(
      Object.entries(element.attributes).map(([name, value]) => [
        name,
        decodeXmlEntities(normalizeLineEndings(value)),
      ]),
    );
    const context = parent.child(attributes);
    const normalized = { ...context.normalizedAttributes() };
    delete normalized.id;
    for (const name of Object.keys(normalized)) {
      if (name.startsWith('xmlns')) delete normalized[name];
    }
    const childContext = context.apply(geometryByTag[element.tag] ?? []);
    const children = element.children.map((child) => this.view(child, childContext, depth + 1));
    return {
      tag: element.tag,
      id: this.ids.get(element) ?? null,
      attributes: normalized,
      text: decodeXmlEntities(normalizeLineEndings(element.text)),
      children,
      transform: {
        scale: context.transform.scale,
        translateX: context.transform.dx,
        translateY: context.transform.dy,
      },
    };
  }
}

const normalizeLineEndings = (value: string): string => value.replace(/\r\n?/g, '\n');

const explicitId = (element: SvgSyntaxElement): string | undefined => {
  const value = element.attributes.id;
  return value === undefined ? undefined : decodeXmlEntities(normalizeLineEndings(value));
};
