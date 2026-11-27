import type { Element } from '@xmldom/xmldom';
import type { ChartNode } from './flowchart.js';
import { crosses } from './edgeRouting.js';
import { clearOf } from './curveRoute.js';
import { quadraticPoints } from './session.cjs';
import { elements } from './chartDocument.js';

export function checkInsertSpace(node: ChartNode, unrelatedEdges: Element[]) {
  for (const group of unrelatedEdges) {
    const blocked = elements(group).some((shape) => {
      const n = (key: string) => Number(shape.getAttribute(key));
      if (shape.localName === 'line')
        return crosses({ x: n('x1'), y: n('y1') }, { x: n('x2'), y: n('y2') }, node, 2);
      if (shape.localName !== 'path') return false;
      const p = quadraticPoints(shape.getAttribute('d')!);
      return !clearOf({ x: p.x1, y: p.y1 }, { x: p.cx, y: p.cy }, { x: p.x2, y: p.y2 }, node, 2);
    });
    if (blocked)
      throw new RangeError(
        'Inserted node would cover preserved edge ' +
          group.getAttribute('id') +
          '. Choose free x/y coordinates.',
      );
  }
}
