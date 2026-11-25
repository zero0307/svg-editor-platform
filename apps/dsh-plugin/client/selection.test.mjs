import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { sessionPath, quoteNode, currentSelection } from './selection.js';

test('a selection is a session-local removable quote; existing text and other quotes survive', () => {
  const node = { id: '同名"框', title: 'Add & Norm' };
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
  let draft = '已有要求及其他引用',
    count = 0;
  const input = {
    state: { getSnapshot: () => ({ draft }) },
    insertQuote(text) {
      draft += text;
      count++;
      return true;
    },
    focus() {},
  };
  assert.equal(quoteNode(input, path, node), '');
  assert.deepEqual(currentSelection(draft), { path, nodeId: node.id });
  assert.equal(quoteNode(input, path, node), '');
  assert.equal(count, 1);
  assert.match(quoteNode(input, path, { id: 'other', title: node.title }), /移除/);
  assert.equal(count, 1);
  draft = '新的草稿';
  assert.equal(quoteNode(input, path, { id: 'other', title: node.title }), '');
  assert.equal(count, 2);
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

test('a freeform artwork quote carries the selected label guard and its real line number', () => {
  let draft = '';
  const input = {
    state: { getSnapshot: () => ({ draft }) },
    insertQuote(text) {
      draft = text;
      return true;
    },
    focus() {},
  };
  assert.equal(
    quoteNode(input, '原稿.svg', { id: 'step-2', title: '校验字段', artwork: true, textIndex: 2 }),
    '',
  );
  assert.deepEqual(currentSelection(draft), {
    path: '原稿.svg',
    nodeId: 'step-2',
    textIndex: 2,
    originalText: '校验字段',
  });
  assert.match(draft, /svg_artwork/);
});
