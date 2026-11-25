import { createHash } from 'node:crypto';
import type { Element } from '@xmldom/xmldom';
import type { FileStore } from '@svgframe/core';
import {
  chartNode,
  elements,
  memorySession,
  nativeGraph,
  parseSvg,
  serialize,
} from './chartDocument.js';
import { indexFlowchart, validPortName, type ChartNode, type GraphEdge } from './flowchart.js';
import { SvgTools } from './SvgTools.js';
import { checkInsertSpace } from './editGeometry.js';
import { renameLine } from './renameLine.js';
import { changePreview } from './changePreview.js';

export interface EditRequest {
  path: string;
  output: string;
  operation: 'merge_inputs' | 'rename' | 'reconnect' | 'insert';
  from?: string;
  to?: string;
  inputs?: string[];
  nodeId?: string;
  label?: string;
  labelLine?: number;
  edgeId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  previewPath?: string;
}

export async function editFlowchart(files: FileStore, req: EditRequest) {
  if (
    req.path === req.output ||
    (req.previewPath && [req.path, req.output].includes(req.previewPath))
  )
    throw new RangeError('Choose distinct .svg paths for the original, output and preview.');
  if (req.labelLine !== undefined && req.operation !== 'rename')
    throw new RangeError('labelLine is only valid for rename.');
  const before = await files.read(req.path);
  const { graph, warnings } = await nativeGraph(before);
  if (warnings.length || graph.unresolvedEdges.length || graph.inferredEdges.length)
    throw new RangeError(
      'Fix unresolved edges/import warnings or convert legacy edges before editing.',
    );
  const root = parseSvg(before);
  const all = elements(root);
  if (all.some((e) => e.hasAttribute('transform')))
    throw new RangeError('Editing transformed groups requires flattening their coordinates first.');
  const original = new Map(all.map((e) => [e.getAttribute('id'), e]));
  const byId = (id: string) => {
    const e = original.get(id);
    if (!e) throw new RangeError('Missing element ' + id);
    return e;
  };
  const nodes = graph.nodes.map((n) => chartNode(byId(n.id), n.label));
  const resolve = (key?: string) => {
    const exact = nodes.find((n) => n.id === key);
    const matches = exact
      ? [exact]
      : nodes.filter((n) => n.label === key || n.label.split(/\r?\n/)[0] === key);
    if (matches.length !== 1) throw new RangeError('Choose a unique node ID for ' + String(key));
    return matches[0]!;
  };
  const drop = new Set<string>();
  const removedEdges = new Set<string>();
  const addEdges: GraphEdge[] = [];
  const context: ChartNode[] = [];
  let newNode: ChartNode | undefined;
  let rename: ChartNode | undefined;
  let lineEdit: ReturnType<typeof renameLine> | undefined;
  let edgeColor: string | undefined;
  const fresh = (base: string) => {
    let result = base,
      i = 1;
    while (original.has(result) || addEdges.some((e) => e.id === result)) result = base + '-' + i++;
    return result;
  };
  const removeEdge = (e: GraphEdge) => {
    drop.add(e.id);
    removedEdges.add(e.id);
    edgeColor ??=
      elements(byId(e.id))
        .find((n) => n.getAttribute('data-dsh-part') === 'route')
        ?.getAttribute('stroke') ?? undefined;
  };
  if (req.operation === 'merge_inputs') {
    const from = resolve(req.from),
      to = resolve(req.to),
      inputs = req.inputs;
    if (
      !inputs ||
      inputs.length < 2 ||
      !inputs.every(validPortName) ||
      new Set(inputs).size !== inputs.length
    )
      throw new RangeError('Provide two or more different input names.');
    context.push(from, to);
    for (const name of inputs) {
      const direct = graph.edges.filter(
        (e) => e.from === from.id && e.to === to.id && e.inputs?.includes(name),
      );
      const proxies = nodes.filter(
        (n) =>
          n.label === name &&
          graph.edges.some((e) => e.from === from.id && e.to === n.id) &&
          graph.edges.some((e) => e.from === n.id && e.to === to.id),
      );
      if (direct.length + proxies.length !== 1)
        throw new RangeError(
          'Missing or ambiguous ' + name + ' path from ' + from.id + ' to ' + to.id + '.',
        );
      if (direct.length) {
        const edge = direct[0]!;
        if (edge.inputs!.some((n) => !inputs.includes(n)))
          throw new RangeError('An existing group also carries other ports: ' + edge.id);
        removeEdge(edge);
      } else {
        const proxy = proxies[0]!;
        const incident = graph.edges.filter((e) => e.from === proxy.id || e.to === proxy.id);
        if (incident.length !== 2 || incident.some((e) => e.inputs))
          throw new RangeError('Port node has additional connections: ' + proxy.id);
        incident.forEach(removeEdge);
        drop.add(proxy.id);
        context.push(proxy);
      }
    }
    addEdges.push({ id: fresh(from.id + '--' + to.id), from: from.id, to: to.id, inputs });
  } else if (req.operation === 'rename') {
    rename = resolve(req.nodeId);
    if (!req.label?.trim()) throw new RangeError('Provide a new label.');
    context.push(rename);
    if (req.labelLine !== undefined)
      lineEdit = renameLine(before, byId(rename.id), rename, req.labelLine, req.label);
    rename.label = lineEdit?.label ?? req.label;
  } else {
    const old = graph.edges.find((e) => e.id === req.edgeId);
    if (!old) throw new RangeError('Choose an existing edge ID.');
    const from = resolve(req.from ?? old.from),
      to = resolve(req.to ?? old.to);
    context.push(resolve(old.from), resolve(old.to), from, to);
    removeEdge(old);
    if (req.operation === 'reconnect') {
      addEdges.push({ ...old, from: from.id, to: to.id });
    } else if (req.operation === 'insert') {
      if (!req.nodeId || !req.label?.trim() || original.has(req.nodeId) || req.from || req.to)
        throw new RangeError(
          'Supply a new node ID and label, keeping the existing edge endpoints.',
        );
      const width = req.width ?? 112,
        height = req.height ?? 46;
      newNode = {
        id: req.nodeId,
        label: req.label,
        width,
        height,
        x: req.x ?? (from.x + from.width / 2 + to.x + to.width / 2 - width) / 2,
        y: req.y ?? (from.y + from.height / 2 + to.y + to.height / 2 - height) / 2,
      };
      const n = newNode;
      if (
        n.x < 0 ||
        n.y < 0 ||
        n.x + n.width > Number(root.getAttribute('width')) ||
        n.y + n.height > Number(root.getAttribute('height')) ||
        nodes.some(
          (b) =>
            n.x < b.x + b.width &&
            b.x < n.x + n.width &&
            n.y < b.y + b.height &&
            b.y < n.y + n.height,
        )
      )
        throw new RangeError('Choose free x/y coordinates for the inserted node.');
      checkInsertSpace(
        n,
        graph.edges.filter((e) => e.id !== old.id).map((e) => byId(e.id)),
      );
      nodes.push(n);
      context.push(n);
      addEdges.push(
        { id: fresh(from.id + '--' + n.id), from: from.id, to: n.id },
        { ...old, from: n.id },
      );
    } else throw new RangeError('Unknown editing operation.');
  }
  const kept = nodes.filter((n) => !drop.has(n.id));
  const expectedEdges = [...graph.edges.filter((e) => !removedEdges.has(e.id)), ...addEdges];
  indexFlowchart({ nodes: kept, edges: expectedEdges });
  const presentation = all.some(
    (e) => e.parentNode === root && e.getAttribute('data-dsh-theme') === 'presentation',
  );
  const scratch = memorySession('');
  if (!lineEdit)
    await new SvgTools(scratch.session).createFlowchart({
      path: 'generated.svg',
      theme: presentation ? 'presentation' : undefined,
      width: Number(root.getAttribute('width')),
      height: Number(root.getAttribute('height')),
      nodes: kept,
      edges: addEdges,
    });
  const generated = lineEdit ? root : parseSvg(scratch.contents());
  const resultElements = new Map(elements(generated).map((e) => [e.getAttribute('id'), e]));
  const taken = new Set(
    all.filter((e) => !drop.has(e.getAttribute('id')!)).map((e) => e.getAttribute('id')),
  );
  const generatedId = (e: Element) => {
    const id = e.getAttribute('id')!;
    let name = id,
      i = 1;
    while (taken.has(name)) name = id + '-edit-' + i++;
    taken.add(name);
    e.setAttribute('id', name);
  };
  const top = (id: string) => {
    const element = byId(id);
    if (element.parentNode !== root)
      throw new RangeError('Local edits require top-level native chart groups: ' + id);
    return element;
  };
  const untouched = Array.from(root.childNodes)
    .filter((e): e is Element => e.nodeType === 1)
    .filter((e) => !drop.has(e.getAttribute('id')!) && e.getAttribute('id') !== rename?.id)
    .map((e) => ({ id: e.getAttribute('id'), xml: serialize(e) }));
  const changedElements: Element[] = [];
  if (rename && lineEdit) {
    changedElements.push(top(rename.id));
  } else if (rename) {
    const old = top(rename.id);
    const oldLabels = Array.from(old.getElementsByTagName('text')).filter(
      (e) =>
        e.parentNode === old &&
        (e.getAttribute('id') === rename!.id + '-label' ||
          e.getAttribute('data-dsh-part') === 'label-continuation'),
    );
    const first = oldLabels[0]!;
    const labels = Array.from(resultElements.get(rename.id)!.getElementsByTagName('text'));
    for (const el of oldLabels) {
      taken.delete(el.getAttribute('id'));
      old.removeChild(el);
    }
    for (const label of labels) {
      for (const key of ['fill', 'font-family', 'font-weight', 'text-anchor'])
        if (first.hasAttribute(key) && !(presentation && key === 'font-weight'))
          label.setAttribute(key, first.getAttribute(key)!);
      generatedId(label);
      old.appendChild(root.ownerDocument!.importNode(label, true));
    }
    changedElements.push(old);
  } else {
    const anchor = top([...removedEdges][0]!);
    for (const edge of addEdges) {
      const g = resultElements.get(edge.id)!;
      for (const part of elements(g)) {
        generatedId(part);
        if (edgeColor && part.hasAttribute('stroke')) part.setAttribute('stroke', edgeColor);
        if (edgeColor && part.localName === 'text') part.setAttribute('fill', edgeColor);
      }
      const inserted = root.ownerDocument!.importNode(g, true);
      root.insertBefore(inserted, anchor);
      changedElements.push(inserted);
    }
    for (const id of drop) root.removeChild(top(id));
    if (newNode) {
      const g = resultElements.get(newNode.id)!;
      for (const part of elements(g))
        if (taken.has(part.getAttribute('id')))
          throw new RangeError('Node decoration ID collision.');
      const inserted = root.ownerDocument!.importNode(g, true);
      root.appendChild(inserted);
      changedElements.push(inserted);
    }
  }
  const after = lineEdit?.source ?? serialize(root);
  const outputGroups = new Map(elements(parseSvg(after)).map((e) => [e.getAttribute('id'), e]));
  const changedUnrelated = untouched.filter(({ id, xml }) => {
    const group = outputGroups.get(id);
    return !group || serialize(group) !== xml;
  });
  if (changedUnrelated.length)
    throw new RangeError('Unexpected change to preserved group: ' + changedUnrelated[0]!.id);
  const checked = await nativeGraph(after);
  const edgeKey = (e: GraphEdge) => JSON.stringify([e.id, e.from, e.to, e.inputs ?? []]);
  const actual = new Set(checked.graph.edges.map(edgeKey));
  if (
    checked.warnings.length ||
    checked.graph.unresolvedEdges.length ||
    actual.size !== expectedEdges.length ||
    expectedEdges.some((e) => !actual.has(edgeKey(e))) ||
    checked.graph.nodes.length !== kept.length ||
    kept.some((n) => !checked.graph.nodes.some((x) => x.id === n.id && x.label === n.label))
  )
    throw new RangeError('Candidate failed geometric or label verification.');
  await files.write(req.output, after);
  const delivered = await files.read(req.output);
  if (delivered !== after) throw new Error('Saved SVG differs from the verified candidate.');
  const diskReadBack = lineEdit
    ? {
        originalUnchanged: (await files.read(req.path)) === before,
        outputSha256: createHash('sha256').update(delivered).digest('hex'),
        nodes: checked.graph.nodes.length,
        edges: checked.graph.edges.length,
        warnings: [...checked.warnings],
      }
    : undefined;
  const previewPath = req.previewPath ?? req.output.replace(/\.svg$/i, '-对照.svg');
  let preview: string | undefined, previewError: string | undefined;
  try {
    if (!lineEdit || req.previewPath) {
      await files.write(
        previewPath,
        changePreview(before, after, context, [...drop].map(byId), changedElements),
      );
      preview = previewPath;
    }
  } catch (error) {
    previewError = String(error);
  }
  return {
    path: req.output,
    ...(preview ? { preview } : {}),
    ...(previewError ? { previewError } : {}),
    removedEdges: [...removedEdges],
    addedEdges: addEdges,
    removedPortNodes: [...drop].filter((id) => !removedEdges.has(id)),
    ...(rename || newNode ? { changedNode: (rename ?? newNode)!.id } : {}),
    unrelatedNodesMoved: changedUnrelated.length,
    ...(lineEdit
      ? {
          labelLine: req.labelLine,
          savedLabel: rename!.label,
          otherBytesUnchanged: true,
          diskReadBack,
        }
      : {}),
    verified: true,
  };
}
