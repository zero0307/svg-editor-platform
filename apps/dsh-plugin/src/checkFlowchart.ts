import { elements, nativeGraph, parseSvg } from './chartDocument.js';
export interface ChartExpectations {
  requiredNodes?: string[];
  labels?: { label: string; minimum: number }[];
  connections?: { from: string; to: string; inputs?: string[] }[];
}
export async function checkFlowchart(raw: string, expected: ChartExpectations) {
  const root = parseSvg(raw);
  const all = elements(root);
  const problems: string[] = [];
  for (const item of expected.labels ?? [])
    if (!Number.isInteger(item.minimum) || item.minimum < 1)
      throw new RangeError('minimum must be a positive integer.');
  let native: Awaited<ReturnType<typeof nativeGraph>>;
  try {
    native = await nativeGraph(raw);
    if (all.some((e) => e.hasAttribute('transform')) || !native.graph.nodes.length)
      throw new RangeError('No verifiable native graph in untransformed coordinates.');
  } catch (error) {
    // Plain text is still useful evidence for ordinary, non-native SVG. Never certify its topology.
    const labels = all
      .filter((e) => e.localName === 'text' && !Array.from(e.getElementsByTagName('text')).length)
      .map((e) => e.textContent?.trim());
    for (const item of expected.labels ?? []) {
      const count = labels.filter((s) => s === item.label).length;
      if (count < item.minimum)
        problems.push(
          'Visible-text candidates for ' +
            item.label +
            ': ' +
            count +
            '; expected at least ' +
            item.minimum +
            '.',
        );
    }
    return {
      status: 'unverified',
      problems,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  const { graph, warnings } = native;
  const locations: { id: string; x: number; y: number }[] = [];
  for (const id of expected.requiredNodes ?? [])
    if (!graph.nodes.some((n) => n.id === id)) problems.push('Missing node: ' + id);
  for (const { label, minimum } of expected.labels ?? []) {
    const count = graph.nodes.filter((n) => n.label === label).length;
    if (count < minimum)
      problems.push(
        'Missing node label ' + label + ': found ' + count + ', expected ' + minimum + '.',
      );
  }
  for (const req of expected.connections ?? []) {
    const matching = graph.edges.filter((e) => e.from === req.from && e.to === req.to);
    if (
      !matching.some((e) => !req.inputs || JSON.stringify(e.inputs) === JSON.stringify(req.inputs))
    )
      problems.push(
        'Missing verified connection ' +
          req.from +
          ' → ' +
          req.to +
          (req.inputs ? ' with shared input(s) ' + req.inputs.join('/') : '') +
          '.',
      );
  }
  for (const id of graph.unresolvedEdges) {
    const group = all.find((e) => e.getAttribute('id') === id);
    const ports = group
      ? elements(group).filter((e) => e.getAttribute('data-dsh-part') === 'port')
      : [];
    for (const port of ports) {
      const parts = elements(port),
        branch = parts.find((e) => e.getAttribute('data-dsh-part') === 'branch');
      if (branch && parts.filter((e) => e.getAttribute('data-dsh-part') === 'arrow').length !== 2)
        locations.push({
          id: port.getAttribute('id')!,
          x: Number(branch.getAttribute('x2')),
          y: Number(branch.getAttribute('y2')),
        });
    }
    const broken = ports
      .filter(
        (e) => elements(e).filter((c) => c.getAttribute('data-dsh-part') === 'arrow').length !== 2,
      )
      .map((e) => e.getElementsByTagName('text')[0]?.textContent ?? e.getAttribute('id'));
    problems.push(
      'Unresolved edge ' +
        id +
        (broken.length ? ' (incomplete arrow: ' + broken.join(', ') + ')' : '') +
        '.',
    );
  }
  problems.push(...warnings);
  return {
    status: problems.length ? 'failed' : 'passed',
    problems,
    locations,
    detail: graph.nodes.length + ' nodes, ' + graph.edges.length + ' verified edges',
  };
}
