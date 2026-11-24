import { DomainError } from '../domain/DomainError.js';
import type { EditorEvent } from '../events/EditorEvent.js';
import type { EditorEvents } from '../events/EditorEvents.js';
import type { ReadonlyDocument } from '../domain/ReadonlyDocument.js';
import type { ReadonlyShape } from '../domain/ReadonlyShape.js';
import type { TreeDecoratorRegistry } from '../extensions/TreeDecoratorRegistry.js';
import type { TreeRow } from '../domain/TreeRow.js';

/** Receives a decorator failure together with the failed decorator's stable name. */
export type DecoratorFailureReporter = (error: unknown, decorator: string) => void;

/**
 * Neutral tree/show renderer with the row-suffix decoration pipeline.
 *
 * The base lines are byte-identical to the Phase 1 `ShapePresenter` output when no
 * decorator contributes a suffix. Decorators run in registration order on a
 * read-only `TreeRow`; each non-blank suffix is appended after one space. A
 * decorator that throws (while rendering or while observing a committed event) is
 * reported and disabled for this presenter instance only; the row, document and
 * history stay untouched and other decorators keep contributing.
 */
export class TreePresenter {
  private readonly disabled = new Set<string>();
  private detach: (() => void) | null = null;
  constructor(
    private readonly decorators: TreeDecoratorRegistry,
    private readonly reportFailure: DecoratorFailureReporter = () => {},
  ) {}
  /** Renders the whole document, or the subtree rooted at `id`. */
  tree(document: ReadonlyDocument, id?: string): readonly string[] {
    if (id !== undefined) {
      const node = document.require(id);
      const lines: string[] = [];
      this.visit(lines, document, node, node.parent, 0, '', '');
      return lines;
    }
    const lines: string[] = [];
    lines.push(
      this.decorateLine(
        `svg (${document.width}x${document.height})`,
        this.rowFor(document, document.root, null, 0),
      ),
    );
    const children = document.root.children();
    children.forEach((child, index) => {
      this.visit(
        lines,
        document,
        child,
        document.root,
        1,
        '',
        index === children.length - 1 ? '└── ' : '├── ',
      );
    });
    return lines;
  }
  /** Renders one shape as `show` displays it, with suffixes on the header row. */
  show(document: ReadonlyDocument, id: string): readonly string[] {
    const node = document.require(id);
    const parent = node.parent;
    const header = `${node.tag}#${node.id}  parent=${
      parent === null || parent === document.root ? 'svg' : `${parent.tag}#${parent.id}`
    }`;
    const lines: string[] = [this.decorateLine(header, this.rowFor(document, node, parent, 0))];
    for (const [name, value] of Object.entries(node.attributes())) lines.push(`  ${name}=${value}`);
    const text = node.textContent();
    if (text !== null) lines.push(`  text=${JSON.stringify(text)}`);
    const children = node.children();
    if (children.length) lines.push(`  children=${children.map((child) => child.id).join(', ')}`);
    return lines;
  }
  /** Whether a decorator was disabled after a failure in this presenter instance. */
  isDisabled(name: string): boolean {
    return this.disabled.has(name);
  }
  disabledNames(): readonly string[] {
    return [...this.disabled];
  }
  /**
   * Forwards committed editor events to registered decorators (for stateful
   * labels). A failing `onEvent` disables only that decorator. Returns the
   * disconnect function; one presenter accepts one connection at a time.
   */
  connect(events: EditorEvents): () => void {
    if (this.detach) throw new DomainError('tree presenter is already connected');
    const detach = events.subscribe((event) => this.handleEvent(event));
    this.detach = detach;
    return () => {
      if (this.detach !== detach) return;
      detach();
      this.detach = null;
    };
  }
  /** Direct event delivery for callers that own the subscription. */
  handleEvent(event: EditorEvent): void {
    for (const decorator of this.decorators.entries()) {
      if (this.disabled.has(decorator.name) || !decorator.onEvent) continue;
      try {
        decorator.onEvent(event);
      } catch (error) {
        this.disable(decorator.name, error);
      }
    }
  }
  private visit(
    lines: string[],
    document: ReadonlyDocument,
    node: ReadonlyShape,
    parent: ReadonlyShape | null,
    depth: number,
    prefix: string,
    connector: string,
  ): void {
    const line = `${prefix}${connector}${node.tag}#${node.id}${
      node.summary() ? `  ${node.summary()}` : ''
    }`;
    lines.push(this.decorateLine(line, this.rowFor(document, node, parent, depth)));
    const children = node.children();
    const childPrefix = prefix + (connector === '' ? '' : connector === '└── ' ? '    ' : '│   ');
    children.forEach((child, index) => {
      this.visit(
        lines,
        document,
        child,
        node,
        depth + 1,
        childPrefix,
        index === children.length - 1 ? '└── ' : '├── ',
      );
    });
  }
  private rowFor(
    document: ReadonlyDocument,
    node: ReadonlyShape,
    parent: ReadonlyShape | null,
    depth: number,
  ): TreeRow {
    return { document, node, parent, depth };
  }
  private decorateLine(line: string, row: TreeRow): string {
    const suffixes: string[] = [];
    for (const decorator of this.decorators.entries()) {
      if (this.disabled.has(decorator.name)) continue;
      try {
        const suffix = decorator.decorate(row);
        if (typeof suffix === 'string' && suffix.trim() !== '') suffixes.push(suffix);
      } catch (error) {
        this.disable(decorator.name, error);
      }
    }
    return suffixes.length ? `${line} ${suffixes.join(' ')}` : line;
  }
  private disable(name: string, error: unknown): void {
    this.disabled.add(name);
    try {
      this.reportFailure(error, name);
    } catch {
      // A broken host reporter must not break an already committed display.
    }
  }
}
