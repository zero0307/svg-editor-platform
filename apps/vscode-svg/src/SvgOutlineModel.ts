import type { OutlineNode } from './OutlineNode.js';
import type { OutlineSpan } from './OutlineSpan.js';
import type { OutlineSymbol } from './OutlineSymbol.js';

/**
 * Pure outline model: neutral syntax nodes -> symbol tree.
 *
 * Rules fixed for VS-02: the root, containers and leaves all appear; an element
 * with an id is labelled `tag#id`, an element without an id is labelled `tag`;
 * ids are never assigned, unknown tags are kept and the CLI strict importer is
 * not involved. The model only reads offsets, so `node:test` covers every case
 * without the Extension Host.
 */
export class SvgOutlineModel {
  build(root: OutlineNode | undefined): readonly OutlineSymbol[] {
    return root ? [this.symbolOf(root)] : [];
  }

  private symbolOf(node: OutlineNode): OutlineSymbol {
    return {
      name: SvgOutlineModel.labelOf(node),
      tag: node.tag,
      container: node.children.length > 0,
      range: node.range,
      selectionRange: SvgOutlineModel.selectionOf(node),
      children: node.children.map((child) => this.symbolOf(child)),
    };
  }

  private static labelOf(node: OutlineNode): string {
    return node.id ? `${node.tag}#${node.id}` : node.tag;
  }

  /**
   * Keeps `selectionRange` inside `range` for the host, which requires the
   * selection to be contained; malformed spans fall back to the whole element
   * instead of corrupting the outline.
   */
  private static selectionOf(node: OutlineNode): OutlineSpan {
    const start = Math.max(node.range.start, Math.min(node.startTag.start, node.range.end));
    const end = Math.max(start, Math.min(node.startTag.end, node.range.end));
    return end > start ? { start, end } : node.range;
  }
}
