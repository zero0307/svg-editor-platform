import { crosses, type Bounds } from './edgeRouting.js';
import { clearOf, type Span } from './curveRoute.js';

// Estimate the ink box conservatively, including descenders. The clearance also
// covers the node outline, connector stroke, arrowheads and slight font overhang.
const gap = 5;
interface CaptionBox {
  inset: number;
  align: 'start' | 'end';
  baseline: number;
  size: number;
  width: number;
  belowBaseline: number;
}

export function placeCaption(
  area: Bounds,
  { inset, align, baseline, size, width, belowBaseline }: CaptionBox,
  occupied: readonly Bounds[],
  spans: readonly Span[],
): Bounds | undefined {
  const slack = area.width - 2 * inset - width;
  if (slack < -1e-6) return;
  // Try the requested corner first. Bound the cost and keep the heading near the top.
  const limit = Math.min(area.height - belowBaseline - 2, baseline + 64);
  const rows = [baseline, size + 4];
  for (let y = baseline + 8; y <= limit; y += 8) rows.push(y);
  for (const y of rows) {
    if (y > limit) continue;
    for (const stop of [0, 1, 0.5, 0.25, 0.75]) {
      const fraction = align === 'end' ? 1 - stop : stop;
      const box = {
        x: area.x + inset + fraction * Math.max(0, slack),
        y: area.y + y - size,
        width,
        height: size + belowBaseline,
      };
      if (
        occupied.some(
          (b) =>
            box.x < b.x + b.width + gap &&
            box.x + width > b.x - gap &&
            box.y < b.y + b.height + gap &&
            box.y + box.height > b.y - gap,
        )
      )
        continue;
      if (
        spans.some(({ start, end, control }) =>
          control ? !clearOf(start, control, end, box, gap) : crosses(start, end, box, gap),
        )
      )
        continue;
      return box;
    }
  }
}
