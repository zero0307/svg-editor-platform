import type { FlowchartGraph, GraphEdge } from './flowchart.js';

// Offer edits only when the existing graph shows multiple paths with a common source and target.
// A short uppercase label on a one-in/one-out node is a candidate, never an automatic mutation.
export function portEdits(graph: FlowchartGraph) {
  const incoming = new Map<string, GraphEdge[]>(),
    outgoing = new Map<string, GraphEdge[]>();
  const groups = new Map<string, { from: string; to: string; paths: string[][] }>();
  const add = (from: string, to: string, names: string[]) => {
    const key = JSON.stringify([from, to]);
    const group = groups.get(key) ?? { from, to, paths: [] };
    group.paths.push(names);
    groups.set(key, group);
  };
  for (const e of graph.edges) {
    const ins = incoming.get(e.to) ?? [];
    ins.push(e);
    incoming.set(e.to, ins);
    const outs = outgoing.get(e.from) ?? [];
    outs.push(e);
    outgoing.set(e.from, outs);
    if (e.inputs) add(e.from, e.to, e.inputs);
  }
  for (const node of graph.nodes) {
    const ins = incoming.get(node.id),
      outs = outgoing.get(node.id);
    if (!/^[A-Z][A-Z0-9_]{0,5}$/.test(node.label) || ins?.length !== 1 || outs?.length !== 1)
      continue;
    const a = ins[0]!,
      b = outs[0]!;
    if (!a.inputs && !b.inputs && a.from !== b.to) add(a.from, b.to, [node.label]);
  }
  return [...groups.values()]
    .filter((g) => g.paths.length > 1)
    .flatMap((g) => {
      const inputs = g.paths.flat();
      return new Set(inputs).size !== inputs.length
        ? []
        : [
            {
              tool: 'svg_edit_flowchart',
              operation: 'merge_inputs',
              from: g.from,
              to: g.to,
              inputs,
            },
          ];
    })
    .slice(0, 16);
}
