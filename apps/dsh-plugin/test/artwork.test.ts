import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { artwork } from '../src/artwork.js';
import { artworkTargets } from '../src/artworkTargets.js';
import { parseSvg } from '../src/chartDocument.js';

for (const [name, count, nodeId, title, newTitle] of [
  ['review', 7, 'node-fact-check', '事实核查', '事实复核'],
  ['pipeline', 4, 'step-2', '校验字段与单位', '核对字段与单位'],
  ['ports', 4, 'node-encoder', '编码器记忆', '编码器输出'],
] as const)
  test(
    'freeform ' + name + ' remains byte-identical except the selected editable title',
    async () => {
      const source = await readFile(
        new URL(
          '../../../../doc/evidence/dsh/presentation/trials/' + name + '-without.svg',
          import.meta.url,
        ),
        'utf8',
      );
      const files = new Map([['in.svg', source]]);
      const store = {
        read: async (k: string) => files.get(k)!,
        write: async (k: string, s: string) => {
          assert.ok(!files.has(k));
          files.set(k, s);
        },
      };
      const result = await artwork(store, { operation: 'inspect', path: 'in.svg' });
      assert.ok('nodes' in result);
      assert.equal(result.nodes.length, count);
      assert.equal(files.size, 1);
      const picked = result.nodes.find((n) => n.nodeId === nodeId)!;
      assert.equal(picked.title, title);
      const req = {
        operation: 'rename' as const,
        path: 'in.svg',
        output: 'out.svg',
        nodeId,
        textIndex: picked.textIndex,
        originalText: title,
        label: newTitle,
      };
      await assert.rejects(
        artwork(store, { ...req, originalText: '过期选区' }),
        /no longer matches/,
      );
      assert.equal(files.size, 1);
      const edited = await artwork(store, req);
      assert.ok('diskReadBack' in edited);
      assert.equal(edited.otherBytesUnchanged, true);
      assert.equal(files.get('in.svg'), source);
      assert.equal(
        files.get('out.svg'),
        source.replace('>' + title + '</text>', '>' + newTitle + '</text>'),
      );
    },
  );

test('detached SVG selection follows transformed group/shape, ignores defs/duplicate IDs and addresses duplicate titles precisely', async () => {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -10 320 150"><defs><g id="node-def"><rect width="10" height="10"/><text>Hidden</text></g></defs><g transform="translate(20 30)"><g id="node-a"><rect width="90" height="30" transform="scale(2)"/><text><tspan>A &amp; B</tspan></text></g><g id="node-b"><circle cx="200" cy="40" r="24"/><text>A &amp; B</text></g><g id="node-x"/><g id="node-x"><rect width="90" height="30"/><text>Duplicate ID</text></g></g></svg>';
  const nodes = artworkTargets(parseSvg(source));
  assert.deepEqual(
    nodes.map((n) => n.id),
    ['node-a', 'node-b'],
  );
  assert.equal(nodes[0]!.geometry.transform, 'translate(20 30) scale(2)');
  const files = new Map([['in.svg', source]]);
  await artwork(
    {
      read: async (k) => files.get(k)!,
      write: async (k, s) => {
        files.set(k, s);
      },
    },
    {
      operation: 'rename',
      path: 'in.svg',
      output: 'out.svg',
      nodeId: 'node-a',
      textIndex: 1,
      originalText: 'A & B',
      label: 'Q < K',
    },
  );
  assert.equal(files.get('out.svg'), source.replace('>A &amp; B</tspan>', '>Q &lt; K</tspan>'));
});

test('a formula chip inside a rich card can be edited without changing its design', async () => {
  const source = await readFile(
    new URL('../../../../doc/evidence/dsh/presentation/trials/ports-without.svg', import.meta.url),
    'utf8',
  );
  const files = new Map([['original.svg', source]]);
  const store = {
    read: async (k: string) => files.get(k)!,
    write: async (k: string, s: string) => {
      files.set(k, s);
    },
  };
  const picked = artworkTargets(parseSvg(source)).find((n) => n.id === 'node-attention')!;
  const originalText = 'softmax(QKᵀ) · V',
    label = 'softmax(QKᵀ/√d)V';
  const textIndex = picked.rows.findIndex((r) => r.value === originalText) + 1;
  assert.ok(textIndex > 0);
  await artwork(store, {
    operation: 'rename',
    path: 'original.svg',
    output: 'corrected.svg',
    nodeId: picked.id,
    textIndex,
    originalText,
    label,
  });
  assert.equal(
    files.get('corrected.svg'),
    source.replace('>' + originalText + '</text>', '>' + label + '</text>'),
  );
});
