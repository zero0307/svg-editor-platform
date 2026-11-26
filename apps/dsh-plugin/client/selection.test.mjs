import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { sessionPath, quoteNode, currentSelection } from './selection.js';

function composer(initial = { text: '', references: [], quotes: [] }) {
  let snapshot = initial;
  return {
    get draftSnapshot() {
      return snapshot;
    },
    state: { getSnapshot: () => ({ phase: 'plain', draft: snapshot.text }) },
    setDraft(value) {
      snapshot = value;
    },
    insertQuote(text, summary) {
      const raw = text
        .split('\n')
        .map((line) => '> ' + line)
        .join('\n');
      const quote = { text, summary, offset: snapshot.text.length, length: raw.length };
      snapshot = {
        ...snapshot,
        text: snapshot.text + raw + ' ',
        quotes: [...(snapshot.quotes ?? []), quote],
      };
      return true;
    },
    focus() {},
  };
}

test('resource paths stay session-local', () => {
  const path = '图 #1/Transformer.svg';
  assert.equal(
    sessionPath('dsh-resource://file/session/a/' + encodeURIComponent(path) + '?view=1', 'a'),
    path,
  );
  for (const uri of [
    'dsh-resource://file/session/b/test.svg',
    'dsh-resource://file/session/a/%zz',
    'dsh-resource://file/absolute/tmp/example.svg',
  ])
    assert.equal(sessionPath(uri, 'a'), undefined);
});

test('last pick wins across cards, connectors and files while ordinary text, quotes and references retain their spans', () => {
  const input = composer(),
    path = '闭环.svg';
  input.setDraft({ text: '要求🖊 ', references: [], quotes: [] });
  const a = { id: 'a', title: '同名节点' },
    b = { id: 'b', title: '同名节点' };
  assert.equal(quoteNode(input, path, a), '');
  input.insertQuote('其他插件的引用', { label: '其他', title: '标题', body: '其他插件的引用' });
  const old = input.draftSnapshot,
    after = '@说明';
  const suffix = ' 后续要求，原文示例 SVG 选区 {"path":"fake","nodeId":"a"}';
  input.setDraft({
    ...old,
    text: old.text + after + suffix,
    references: [
      {
        offset: old.text.length,
        length: after.length,
        clipboardText: after,
        source: 'file',
        ref: 'spec',
        label: '说明',
      },
    ],
  });
  const untouched = input.draftSnapshot;
  const edge = { id: 'b', title: '甲 → 乙', from: 'a', to: 'b', parts: [] };
  for (const [file, target] of [
    [path, b],
    [path, edge],
    ['新图.svg', { ...a, artwork: true, textIndex: 2 }],
    [path, a],
  ]) {
    assert.equal(quoteNode(input, file, target), '');
    const now = input.draftSnapshot,
      selected = currentSelection(now);
    assert.equal(selected.path, file);
    assert.equal(selected.edgeId ?? selected.nodeId, target.id);
    assert.equal(now.quotes.length, 2);
    assert.equal(now.quotes[1].summary.label, '其他');
    assert.equal(now.text.slice(0, now.quotes[0].offset), '要求🖊 ');
    assert.equal(
      now.text.slice(now.quotes[0].offset + now.quotes[0].length),
      untouched.text.slice(untouched.quotes[0].offset + untouched.quotes[0].length),
    );
    assert.equal(
      now.text.slice(now.references[0].offset, now.references[0].offset + after.length),
      after,
    );
    assert.ok(now.text.slice(now.quotes[1].offset).startsWith('> 其他插件的引用'));
    assert.equal(quoteNode(input, file, target), '');
    assert.equal(input.draftSnapshot, now);
    if (target.artwork) {
      assert.equal(selected.textIndex, 2);
      assert.equal(selected.originalText, target.title);
    }
  }
  input.state.getSnapshot = () => ({ phase: 'sending' });
  const previous = input.draftSnapshot;
  assert.ok(quoteNode(input, path, b));
  assert.equal(input.draftSnapshot, previous);
  input.state.getSnapshot = () => ({ phase: 'plain' });
  input.insertQuote = () => false;
  assert.ok(quoteNode(input, path, b));
  assert.equal(input.draftSnapshot, previous);
});

test('manual removal and submission clear the target, and pasted selection text is ordinary text', () => {
  const input = composer(),
    path = '稿件.svg',
    a = { id: 'a', title: '需求' };
  quoteNode(input, path, a);
  const { text } = input.draftSnapshot;
  input.setDraft({ text, references: [], quotes: [] });
  assert.equal(currentSelection(input.draftSnapshot), undefined);
  quoteNode(input, path, { ...a, id: 'b' });
  assert.equal(input.draftSnapshot.quotes.length, 1);
  input.setDraft({ text: '', references: [] });
  assert.equal(currentSelection(input.draftSnapshot), undefined);
  quoteNode(input, path, a);
  assert.deepEqual(currentSelection(input.draftSnapshot), { path, nodeId: 'a' });
});

test('the packed browser entry registers the metadata and keyed preview under the same id', () => {
  let row, definition, slot;
  runInNewContext(readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (r) => (row = r) } },
  });
  const plugin = row.factory((request) => {
    assert.equal(request, 'react');
    return {};
  });
  plugin.apply({
    effect: (fn) => fn(),
    documentPreviews: { register: (v) => (definition = v) },
    slots: {
      inject: (_name, fn) => fn(),
      register: (v, render) => {
        slot = v;
        assert.equal(typeof render, 'function');
      },
    },
  });
  assert.equal(row.id, 'dsh-svg-editor');
  assert.equal(definition.extensions[0], 'svg');
  assert.equal(definition.id, slot.key);
});

test('the edge quote keeps the original address separate from staged endpoints and shape; a new pick clears them', () => {
  const input = composer(),
    path = '迭代.svg';
  const edge = {
    id: 'line',
    artwork: true,
    parts: [],
    reconnectable: true,
    title: '需求 → 方案',
    from: 'a',
    to: 'b',
    originalGeometry: 'old',
  };
  quoteNode(input, path, edge);
  const changes = { from: 'c', to: 'd', connectorStyle: 'arc' };
  quoteNode(input, path, { ...edge, changes });
  assert.deepEqual(currentSelection(input.draftSnapshot), {
    path,
    edgeId: 'line',
    originalGeometry: 'old',
    from: 'a',
    to: 'b',
    changes,
  });
  assert.equal(input.draftSnapshot.quotes.length, 1);
  quoteNode(input, path, { id: 'a', title: '需求' });
  assert.deepEqual(currentSelection(input.draftSnapshot), { path, nodeId: 'a' });
});
