import { ContainerShape } from '@svgframe/core';
import type { ReadonlyDocument, ReadonlyShape } from '@svgframe/core';

/**
 * `stats` tally: one line of leaf counts in first-appearance order plus the
 * container/total summary, exactly as Phase 2 §2.1 specifies.
 *
 * The walk starts at the canvas child nodes in their current order and is
 * depth-first. Leaves are counted by the public domain `kind`, so a plugin type
 * such as `box` never needs a kernel branch; containers are recognised by the
 * public `ContainerShape` capability instead of names or leaf counts, so `g`,
 * `box` and any future plugin container count as containers while the root SVG
 * does not. Leaves inside a container are still counted.
 */
export class StatsTally {
  report(document: ReadonlyDocument): string {
    const leaves = new Map<string, number>();
    let containers = 0;
    let total = 0;
    const visit = (shape: ReadonlyShape): void => {
      if (shape instanceof ContainerShape) {
        containers++;
        shape.children().forEach(visit);
        return;
      }
      leaves.set(shape.kind, (leaves.get(shape.kind) ?? 0) + 1);
      total++;
    };
    document.root.children().forEach(visit);
    const counts = [...leaves].map(([kind, count]) => `${kind}: ${count}`);
    return [...counts, `(total ${total}, containers ${containers})`].join('  ');
  }
}
