import { DomainError } from '@svgframe/core';
import type { ReadonlyDocument, ReadonlyShape } from '@svgframe/core';
import type { SvgFileGateway } from './SvgFileGateway.js';
import type { SvgRuntime } from './SvgRuntime.js';

/** Phase 1 provider order first; unknown kinds follow in stable alphabetical order. */
const KIND_ORDER = ['rect', 'circle', 'ellipse', 'line', 'text', 'g'] as const;

/** Structured result of one read-only SVG inspection. */
export interface SvgInspection {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly elements: number;
  readonly kinds: Readonly<Record<string, number>>;
  readonly rootChildren: readonly string[];
}

/**
 * Read-only inspection over the public runtime: decode through the strict codec
 * and the registered providers, then project canvas size, element count, kind
 * histogram and root children. The file is never written.
 */
export class SvgInspector {
  constructor(private readonly runtime: SvgRuntime) {}

  async inspect(
    path: string,
    gateway: SvgFileGateway,
    signal?: AbortSignal,
  ): Promise<SvgInspection> {
    if (typeof path !== 'string' || path.trim().length === 0)
      throw new DomainError('path must be a non-empty string');
    signal?.throwIfAborted();

    const target = await gateway.resolve(path, { signal });
    const info = await gateway.stat(target, signal);
    if (info === undefined) throw new DomainError(`file not found: ${path}`);

    signal?.throwIfAborted();
    const source = await gateway.readText(target, signal);
    signal?.throwIfAborted();
    const { document } = this.runtime.codec.decode(source);
    document.validate();
    return SvgInspector.project(path, document);
  }

  /** Pure projection shared by tests and the tool body. */
  static project(path: string, document: ReadonlyDocument): SvgInspection {
    const elements = document.all();
    return Object.freeze({
      path,
      width: document.width,
      height: document.height,
      elements: elements.length,
      kinds: Object.freeze(SvgInspector.countKinds(elements)),
      rootChildren: Object.freeze(document.root.children().map((shape) => shape.id)),
    });
  }

  private static countKinds(elements: readonly ReadonlyShape[]): Record<string, number> {
    const counts = new Map<string, number>();
    for (const element of elements) counts.set(element.kind, (counts.get(element.kind) ?? 0) + 1);
    const ordered = [...counts.entries()].sort(([left], [right]) => {
      const leftIndex = KIND_ORDER.indexOf(left as (typeof KIND_ORDER)[number]);
      const rightIndex = KIND_ORDER.indexOf(right as (typeof KIND_ORDER)[number]);
      if (leftIndex !== -1 || rightIndex !== -1)
        return (
          (leftIndex === -1 ? KIND_ORDER.length : leftIndex) -
          (rightIndex === -1 ? KIND_ORDER.length : rightIndex)
        );
      return left < right ? -1 : left > right ? 1 : 0;
    });
    return Object.fromEntries(ordered);
  }
}
