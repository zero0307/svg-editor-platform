import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { nativeGraph } from '../dist/src/chartDocument.js';

// An independent byte-level oracle for the five duplicate titles in the published fixture.
const [nodeId, result] = process.argv.slice(2);
assert.ok(
  ['d_an3', 'e_an1', 'e_an2', 'd_an2', 'd_an1'].includes(nodeId) && result,
  'Usage: node apps/dsh-plugin/verification/selection-result.mjs <nodeId> <result.svg>',
);
const source = await readFile(
  new URL('../../../doc/evidence/dsh/local-edits/before.svg', import.meta.url),
  'utf8',
);
assert.equal(
  createHash('sha256').update(source).digest('hex'),
  'dd6d38d6609c61f89e4f0693147f69329a20d655a36c7560b4898fed800df9ac',
);
const old = new RegExp('(<text id="' + nodeId + '-label"[^>]*>)Add &amp; Norm(</text>)', 'g');
assert.equal([...source.matchAll(old)].length, 1);
const actual = await readFile(result, 'utf8');
assert.ok(
  actual === source.replace(old, '$1课堂重点$2'),
  'The saved SVG differs outside the requested title, or the selected title was not changed.',
);
const { graph, warnings } = await nativeGraph(actual);
assert.equal(graph.nodes.length, 35);
assert.equal(graph.edges.length, 40);
assert.deepEqual(warnings, []);
console.log(JSON.stringify({ nodeId, otherBytesUnchanged: true, nodes: 35, edges: 40, warnings }));
