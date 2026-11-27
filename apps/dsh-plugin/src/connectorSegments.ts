import svgpath from './svgpath.cjs';
import type { EdgeTarget } from './edgeTargets.js';
import { addSpanSegments, flattenCubic, type Segment } from './connectorCrossings.js';

// Convert only visible, recognised connector geometry into canvas coordinates.
// SVGPath normalises relative, shorthand and elliptical commands before subdivision.
export function connectorSegments(edges: readonly EdgeTarget[], originX = 0, originY = 0) {
  const segments: Segment[] = [];
  for (const edge of edges)
    for (const { shape, geometry: g } of edge.parts) {
      const path =
        shape === 'path'
          ? g.d
          : shape === 'polyline'
            ? 'M' + g.points
            : 'M' + g.x1 + ' ' + g.y1 + 'L' + g.x2 + ' ' + g.y2;
      if (!path) continue;
      const normalized = svgpath(path).abs().unshort().unarc();
      if (g.transform) normalized.transform(g.transform);
      normalized.translate(-originX, -originY);
      let move = { x: 0, y: 0 };
      normalized.iterate((s, _index, x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !s.slice(1).every(Number.isFinite))
          return;
        const start = { x, y };
        switch (s[0]) {
          case 'M':
            move = { x: s[1], y: s[2] };
            break;
          case 'L':
            segments.push({ start, end: { x: s[1], y: s[2] } });
            break;
          case 'H':
            segments.push({ start, end: { x: s[1], y } });
            break;
          case 'V':
            segments.push({ start, end: { x, y: s[1] } });
            break;
          case 'Z':
          case 'z':
            segments.push({ start, end: move });
            break;
          case 'Q':
            addSpanSegments(
              { start, control: { x: s[1], y: s[2] }, end: { x: s[3], y: s[4] } },
              segments,
            );
            break;
          case 'C':
            flattenCubic(
              start,
              { x: s[1], y: s[2] },
              { x: s[3], y: s[4] },
              { x: s[5], y: s[6] },
              segments,
            );
            break;
        }
      });
    }
  return segments;
}
