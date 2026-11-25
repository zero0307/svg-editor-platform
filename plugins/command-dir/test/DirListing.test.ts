import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDirectoryReader } from '@svgframe/core';
import { DirListing } from '../index.js';
import { RecordingDirectoryReader } from './RecordingDirectoryReader.js';

test('dir groups directories, files, links and other entries with two-space markers', async () => {
  const lines = await new DirListing().render(
    new FakeDirectoryReader('/work', {
      '/work': [
        { name: 'zeta.txt', kind: 'file' },
        { name: 'beta', kind: 'directory' },
        { name: 'socket', kind: 'other' },
        { name: 'shortcut', kind: 'link' },
        { name: 'zeta-dir', kind: 'directory' },
        { name: 'Alpha.md', kind: 'file' },
      ],
    }),
  );
  assert.deepEqual(lines, [
    '[DIR]  beta',
    '[DIR]  zeta-dir',
    '[FILE]  Alpha.md',
    '[FILE]  zeta.txt',
    '[LINK]  shortcut',
    '[OTHER]  socket',
  ]);
  for (const line of lines) assert.match(line, /^\[(?:DIR|FILE|LINK|OTHER)\] {2}\S/);
});

test('dir sorts names with case-sensitive JavaScript string order', async () => {
  const lines = await new DirListing().render(
    new FakeDirectoryReader('/work', {
      '/work': [
        { name: 'apple', kind: 'file' },
        { name: 'a.txt', kind: 'file' },
        { name: 'Zebra', kind: 'file' },
        { name: 'B.txt', kind: 'file' },
      ],
    }),
  );
  assert.deepEqual(lines, ['[FILE]  B.txt', '[FILE]  Zebra', '[FILE]  a.txt', '[FILE]  apple']);
});

test('dir keeps hidden entries and sorts them by the same rule', async () => {
  const lines = await new DirListing().render(
    new FakeDirectoryReader('/work', {
      '/work': [
        { name: 'visible.txt', kind: 'file' },
        { name: '.config', kind: 'directory' },
        { name: '.hidden', kind: 'file' },
      ],
    }),
  );
  assert.deepEqual(lines, ['[DIR]  .config', '[FILE]  .hidden', '[FILE]  visible.txt']);
});

test('dir output is stable regardless of adapter input order', async () => {
  const entries = [
    { name: 'sub-b', kind: 'directory' as const },
    { name: 'b.txt', kind: 'file' as const },
    { name: 'sub-a', kind: 'directory' as const },
    { name: 'a.txt', kind: 'file' as const },
  ];
  const orders = [
    entries,
    [...entries].reverse(),
    [entries[2]!, entries[1]!, entries[3]!, entries[0]!],
    [entries[1]!, entries[3]!, entries[0]!, entries[2]!],
  ];
  const expected = ['[DIR]  sub-a', '[DIR]  sub-b', '[FILE]  a.txt', '[FILE]  b.txt'];
  for (const order of orders) {
    const reader = new FakeDirectoryReader('/work', { '/work': order });
    assert.deepEqual(await new DirListing().render(reader), expected);
  }
});

test('an empty directory prints the frozen wording', async () => {
  const reader = new FakeDirectoryReader('/work', { '/work': [] });
  assert.deepEqual(await new DirListing().render(reader), ['(empty directory)']);
});

test('dir lists only direct children and reaches the port with cwd then list(cwd)', async () => {
  const reader = new RecordingDirectoryReader('/work', [
    { name: 'sub', kind: 'directory' },
    { name: 'a.txt', kind: 'file' },
  ]);
  assert.deepEqual(await new DirListing().render(reader), ['[DIR]  sub', '[FILE]  a.txt']);
  assert.deepEqual(reader.calls, ['cwd', 'list /work']);
});

test('directory read failures keep the adapter wording for the dispatcher', async () => {
  const reader = new FakeDirectoryReader('/missing');
  await assert.rejects(new DirListing().render(reader), /cannot read directory: \/missing/);
});
