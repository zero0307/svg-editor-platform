import type { Chart, Tone } from './flowchart.js';

export type ChartTheme = 'studio' | 'print' | 'presentation';
type NodeRole = 'start' | 'step' | 'split' | 'join' | 'end';
type Paint = { fill: string; stroke: string; ink: string; radius: number };
type Palette = { connector: string; nodes: Record<NodeRole, Paint> };

const palettes: Record<ChartTheme, Palette> = {
  presentation: {
    connector: '#536379',
    nodes: {
      start: { fill: '#24364C', stroke: '#24364C', ink: '#FFFFFF', radius: 9 },
      step: { fill: '#FFFFFF', stroke: '#A1AFBF', ink: '#23364C', radius: 7 },
      split: { fill: '#EEEAFE', stroke: '#9385C6', ink: '#493875', radius: 8 },
      join: { fill: '#DBF3EF', stroke: '#63A89C', ink: '#155E54', radius: 8 },
      end: { fill: '#185D56', stroke: '#185D56', ink: '#FFFFFF', radius: 9 },
    },
  },
  studio: {
    connector: '#496979',
    nodes: {
      start: { fill: '#193B50', stroke: '#193B50', ink: '#FFFFFF', radius: 13 },
      step: { fill: '#F3F7FA', stroke: '#8CA6B3', ink: '#18384A', radius: 8 },
      split: { fill: '#FFF0D8', stroke: '#B67B2E', ink: '#684013', radius: 8 },
      join: { fill: '#DFEFED', stroke: '#59978F', ink: '#174D47', radius: 8 },
      end: { fill: '#166758', stroke: '#166758', ink: '#FFFFFF', radius: 13 },
    },
  },
  print: {
    connector: '#494949',
    nodes: {
      start: { fill: '#F5F5F5', stroke: '#444444', ink: '#161616', radius: 13 },
      step: { fill: '#FFFFFF', stroke: '#626262', ink: '#171717', radius: 5 },
      split: { fill: '#E3E3E3', stroke: '#373737', ink: '#171717', radius: 5 },
      join: { fill: '#E3E3E3', stroke: '#373737', ink: '#171717', radius: 5 },
      end: { fill: '#333333', stroke: '#333333', ink: '#FFFFFF', radius: 13 },
    },
  },
};

export function chartPaint(chart: Chart) {
  const theme = chart.theme ?? 'studio';
  if (!Object.hasOwn(palettes, theme))
    throw new RangeError('Choose chart theme studio, presentation or print.');
  const palette = palettes[theme];
  const neighbors = new Map(
    chart.nodes.map((n) => [n.id, { incoming: new Set<string>(), outgoing: new Set<string>() }]),
  );
  for (const edge of chart.edges) {
    neighbors.get(edge.from)!.outgoing.add(edge.to);
    neighbors.get(edge.to)!.incoming.add(edge.from);
  }
  function node(id: string, tone?: Tone | 'warm') {
    if (tone === 'normal') return palette.nodes.step;
    if (tone === 'warm') return palette.nodes.split;
    if (tone) {
      if (tone === 'strong') return palette.nodes.start;
      if (tone === 'accent') return palette.nodes.join;
      if (tone === 'muted' && theme === 'presentation')
        return { fill: '#F8FAFC', stroke: '#A2ADBB', ink: '#42536A', radius: 6 };
      if (tone === 'muted')
        return theme === 'print'
          ? palette.nodes.step
          : { fill: '#FAF5DD', stroke: '#CAC08B', ink: '#655A26', radius: 12 };
      throw new RangeError('Unknown node tone.');
    }
    const { incoming, outgoing } = neighbors.get(id)!;
    let role: NodeRole = 'step';
    if (!incoming.size && outgoing.size) role = 'start';
    else if (incoming.size && !outgoing.size) role = 'end';
    else if (outgoing.size > 1) role = 'split';
    else if (incoming.size > 1) role = 'join';
    return palette.nodes[role];
  }
  return { connector: palette.connector, node };
}
