import type { Point } from './edgeRouting.js';

export interface Port extends Point {
  dx: number;
  dy: number;
}

// Fallback for alternating obstacles: search intersections of the existing free corridors.
// Predecessors avoid storing a copy of the entire path at every visited intersection.
export function corridorRoute(
  xs: Set<number>,
  ys: Set<number>,
  sources: Port[],
  targets: Port[],
  step: number,
  inside: (p: Point) => boolean,
  clear: (a: Point, b: Point) => boolean,
  clearCorridor: (a: Point, b: Point) => boolean,
): Point[] {
  const entries = (ports: Port[]) =>
    ports
      .map((port) => ({ port, stub: { x: port.x + step * port.dx, y: port.y + step * port.dy } }))
      .filter(({ port, stub }) => inside(stub) && clear(port, stub));
  const starts = entries(sources),
    ends = entries(targets);
  for (const { stub } of [...starts, ...ends]) {
    xs.add(stub.x);
    ys.add(stub.y);
  }
  const axisX = [...xs].sort((a, b) => a - b),
    axisY = [...ys].sort((a, b) => a - b);
  const width = axisX.length;
  const key = (p: Point) => axisY.indexOf(p.y) * width + axisX.indexOf(p.x);
  const point = (id: number) => ({ x: axisX[id % width]!, y: axisY[Math.floor(id / width)]! });
  const startPorts = new Map(starts.map((entry) => [key(entry.stub), entry.port]));
  const endPorts = new Map(ends.map((entry) => [key(entry.stub), entry.port]));
  const queue = [...startPorts.keys()],
    previous = new Map(queue.map((id) => [id, -1]));
  for (const id of queue) {
    const finish = endPorts.get(id);
    if (finish) {
      const path: Point[] = [finish];
      let current = id;
      while (previous.get(current) !== -1) {
        path.push(point(current));
        current = previous.get(current)!;
      }
      path.push(point(current), startPorts.get(current)!);
      return path.reverse();
    }
    const ix = id % width,
      iy = Math.floor(id / width);
    for (const [nx, ny] of [
      [ix - 1, iy],
      [ix + 1, iy],
      [ix, iy - 1],
      [ix, iy + 1],
    ] as const) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= axisY.length) continue;
      const next = ny * width + nx;
      if (previous.has(next) || !clearCorridor(point(id), point(next))) continue;
      previous.set(next, id);
      queue.push(next);
    }
  }
  return [];
}
