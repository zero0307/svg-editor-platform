import { crosses, type Point } from './edgeRouting.js';
import type { Chart, ChartNode, GraphEdge } from './flowchart.js';

// Each source gets consecutive entry slots on the facing side of a shared target.
// Leave the last segment perpendicular so the fork and its labels occupy their own space.
export const portPitch = 38;
export function automaticPorts(chart: Chart, nodes: ReadonlyMap<string, ChartNode>) {
  const routes = new Map<string, Point[]>();
  if (!chart.autoDirection) return routes;
  const down = chart.autoDirection === 'down';
  const groups = new Map<string, GraphEdge[]>();
  for (const edge of chart.edges) {
    if (!edge.inputs) continue;
    const group = groups.get(edge.to) ?? [];
    group.push(edge);
    groups.set(edge.to, group);
  }
  const along = (n: ChartNode) => (down ? n.y : n.x);
  const depth = (n: ChartNode) => (down ? n.height : n.width);
  const across = (n: ChartNode) => (down ? n.x + n.width / 2 : n.y + n.height / 2);
  const point = (a: number, b: number) => (down ? { x: b, y: a } : { x: a, y: b });
  for (const [id, incoming] of groups) {
    const target = nodes.get(id)!;
    const total = incoming.reduce((sum, e) => sum + e.inputs!.length, 0);
    if (incoming.length < 2 || target.shape === 'ellipse') continue;
    incoming.sort((a, b) => across(nodes.get(a.from)!) - across(nodes.get(b.from)!));
    let firstSlot = across(target) - ((total - 1) * portPitch) / 2;
    for (const edge of incoming) {
      const count = edge.inputs!.length;
      const entry = firstSlot + ((count - 1) * portPitch) / 2;
      firstSlot += count * portPitch;
      const source = nodes.get(edge.from)!;
      const start = along(source) + depth(source),
        end = along(target);
      if (end <= start) continue;
      const mid = start + (end - start) / 3;
      const sourceCentre = across(source);
      const straightRange = (down ? source.width : source.height) / 2 - 13;
      const lateral =
        source.shape !== 'ellipse' && Math.abs(entry - sourceCentre) <= straightRange
          ? entry
          : sourceCentre;
      const path =
        lateral === entry
          ? [point(start, lateral), point(end, entry)]
          : [point(start, lateral), point(mid, lateral), point(mid, entry), point(end, entry)];
      if (
        path
          .slice(1)
          .every(
            (p, i) =>
              !chart.nodes.some((n) => n !== source && n !== target && crosses(path[i]!, p, n, 4)),
          )
      )
        routes.set(edge.id, path);
    }
  }
  return routes;
}
