import { portPitch } from './automaticPorts.js';
import { cachedWrap } from './chartText.js';
import type { Chart, ChartNode } from './flowchart.js';
import { layoutFlowchart } from './layoutFlowchart.js';

type NodeInput = Pick<ChartNode, 'id' | 'label' | 'tone' | 'shape'> &
  Partial<Pick<ChartNode, 'x' | 'y' | 'width' | 'height'>>;
export type ChartInput = Omit<Chart, 'nodes' | 'width' | 'height'> & {
  nodes: readonly NodeInput[];
  width?: number;
  height?: number;
  direction?: 'right' | 'down';
  format?: 'slide' | 'content';
};

export function prepareChart(input: ChartInput): Chart {
  const geometry = ['x', 'y', 'width', 'height'] as const;
  const manual =
    input.width !== undefined ||
    input.height !== undefined ||
    input.nodes.some((n) => geometry.some((k) => n[k] !== undefined));
  if (manual) {
    if (
      !input.width ||
      !input.height ||
      input.nodes.some((n) => !geometry.every((k) => typeof n[k] === 'number'))
    )
      throw new RangeError(
        'Supply both canvas dimensions and all four coordinates on every node, or omit all geometry for automatic layout.',
      );
    if (input.direction || input.format)
      throw new RangeError(
        'For automatic layout, omit geometry. To keep these coordinates, remove direction and format and retry.',
      );
    return {
      ...input,
      width: input.width,
      height: input.height,
      nodes: input.nodes as ChartNode[],
    };
  }
  if (input.panels?.length)
    throw new RangeError(
      'Panels have fixed bounds. Supply explicit node and canvas geometry to place them.',
    );
  if (input.direction && !['right', 'down'].includes(input.direction))
    throw new RangeError('Choose direction right or down.');
  const plan = layoutFlowchart(input);
  const wrap = cachedWrap();
  const ranks = new Map<number, ChartNode[]>(),
    predecessors = new Map<string, string[]>();
  const positions = new Map<string, number>();
  let width = 136;
  for (const n of plan.nodes) {
    const textWidth = n.label
      .split(/\r\n|\r|\n/)
      .reduce((w, line, i) => Math.max(w, wrap(line, Infinity)[0]!.width * (i ? 0.85 : 1)), 0);
    width = Math.max(width, Math.min(248, Math.ceil((textWidth + 36) / 8) * 8));
    const center = n.x + n.width / 2;
    const rank = ranks.get(center) ?? [];
    rank.push(n);
    ranks.set(center, rank);
    predecessors.set(n.id, []);
  }
  for (const edge of plan.edges) predecessors.get(edge.to)!.push(edge.from);
  const ordered = [...ranks].sort(([a], [b]) => a - b).map(([, rank]) => rank);
  for (const rank of ordered) {
    const scores = new Map(
      rank.map((n, i) => {
        const previous = predecessors.get(n.id)!;
        const score = previous.length
          ? previous.reduce((s, id) => s + positions.get(id)!, 0) / previous.length
          : (i + 0.5) / rank.length;
        return [n.id, score];
      }),
    );
    rank.sort((a, b) => scores.get(a.id)! - scores.get(b.id)!);
    for (const [i, n] of rank.entries()) {
      positions.set(n.id, (i + 0.5) / rank.length);
      n.width = width;
      n.height = Math.ceil(Math.max(52, n.height) / 4) * 4;
    }
  }
  const portCounts = new Map<string, number>();
  const namedIncoming = new Map<string, number>();
  for (const e of input.edges) {
    if (!e.inputs) continue;
    portCounts.set(e.to, (portCounts.get(e.to) ?? 0) + e.inputs.length);
    namedIncoming.set(e.to, (namedIncoming.get(e.to) ?? 0) + 1);
  }
  function arrange(down: boolean) {
    const gapAcross = 32,
      gapAlong = down ? 48 : 64,
      margin = 32;
    const along = (n: ChartNode) => (down ? n.height : n.width);
    const across = (n: ChartNode) => (down ? n.width : n.height);
    const ranks = ordered.map((rank) =>
      rank.map((n) => {
        if ((namedIncoming.get(n.id) ?? 0) < 2) return n;
        const minimum = 32 + ((portCounts.get(n.id) ?? 1) - 1) * portPitch;
        return down
          ? { ...n, width: Math.max(n.width, minimum) }
          : { ...n, height: Math.max(n.height, minimum) };
      }),
    );
    // Ranks of equal breadth share lane centres even when their labels wrap differently.
    const lanes = new Map<number, number[]>();
    for (const rank of ranks) {
      const sizes = lanes.get(rank.length) ?? rank.map(() => 0);
      rank.forEach((n, i) => {
        sizes[i] = Math.max(sizes[i]!, across(n));
      });
      lanes.set(rank.length, sizes);
    }
    const spread = ranks.map((rank) =>
      lanes.get(rank.length)!.reduce((s, size) => s + size, (rank.length - 1) * gapAcross),
    );
    const breadth = spread.reduce((a, b) => Math.max(a, b), 0);
    let advance = margin;
    const placed = new Map<string, ChartNode>();
    for (const [i, rank] of ranks.entries()) {
      const depth = rank.reduce((s, n) => Math.max(s, along(n)), 0);
      let lateral = margin + (breadth - spread[i]!) / 2;
      const sizes = lanes.get(rank.length)!;
      for (const [j, n] of rank.entries()) {
        const crossCenter = lateral + (sizes[j]! - across(n)) / 2;
        const center = advance + (depth - along(n)) / 2;
        placed.set(n.id, { ...n, x: down ? crossCenter : center, y: down ? center : crossCenter });
        lateral += sizes[j]! + gapAcross;
      }
      advance += depth + gapAlong;
    }
    const length = advance - gapAlong + margin,
      cross = breadth + 2 * margin;
    const regularWidth = down ? cross : length;
    // Keep the header readable on a narrow vertical chart.
    const titleWidth = input.title
      ? Math.min(580, Math.ceil((wrap(input.title, Infinity)[0]!.width * 34) / 15) + 64)
      : 0;
    const canvasWidth = Math.max(regularWidth, titleWidth, input.subtitle ? 360 : 0);
    const header = input.title
      ? 56 + (input.subtitle ? wrap(input.subtitle, canvasWidth - 56).length * 20 + 8 : 0)
      : 0;
    return {
      autoDirection: down ? ('down' as const) : ('right' as const),
      width: canvasWidth,
      height: (down ? length : cross) + header,
      nodes: input.nodes.map((n) => {
        const card = placed.get(n.id)!;
        return { ...card, x: card.x + (canvasWidth - regularWidth) / 2, y: card.y + header };
      }),
    };
  }
  const right = arrange(false);
  let layout = right;
  if (input.direction !== 'right') {
    const down = arrange(true);
    const distance = (w: number, h: number) => Math.abs(Math.log(w / h / (16 / 9)));
    if (
      input.direction === 'down' ||
      distance(down.width, down.height) < distance(right.width, right.height)
    )
      layout = down;
  }
  // Compact diagrams for projection get a true 16:9 page. Portrait flows stay vertical
  // beside the title. Long technical diagrams can retain their natural reading size.
  const useSlide =
    input.format === 'slide' ||
    (input.format !== 'content' &&
      !!input.title &&
      (!input.theme || input.theme === 'presentation') &&
      layout.width <= 1320 &&
      layout.height <= 760);
  let slideTitleWidth: number | undefined;
  if (useSlide) {
    const minY = layout.nodes.reduce((top, n) => Math.min(top, n.y), Infinity);
    const maxY = layout.nodes.reduce((bottom, n) => Math.max(bottom, n.y + n.height), 0);
    const bodyHeight = maxY - minY;
    const side =
      !!input.title &&
      layout.width / layout.height < 1.3 &&
      wrap(input.title, Infinity)[0]!.width < 170 &&
      (input.subtitle?.length ?? 0) < 90;
    const unit = Math.ceil(
      Math.max(
        (layout.width + (side ? 240 : 0)) / 16,
        (side ? bodyHeight + 80 : layout.height) / 9,
        24,
      ),
    );
    const width = unit * 16,
      height = unit * 9;
    slideTitleWidth = side
      ? Math.min(Math.round(width * 0.34), width - layout.width - 16)
      : undefined;
    const dx = (width - layout.width + (slideTitleWidth ?? 0)) / 2;
    const dy = side ? (height - bodyHeight) / 2 - minY : (height - layout.height) / 2;
    layout = {
      ...layout,
      width,
      height,
      nodes: layout.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
    };
  }
  return {
    ...input,
    ...layout,
    ...(slideTitleWidth ? { slideTitleWidth } : {}),
    theme: input.theme ?? 'presentation',
    connectorStyle: input.connectorStyle ?? 'rounded',
  };
}
