import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DomainError, type DirectoryEntry } from '@svgframe/core';
import { LocalDirectoryReader } from '../index.js';

const makeDirectory = (): Promise<string> => mkdtemp(path.join(tmpdir(), 'svgframe-host-dir-'));
const cleanUp = (directory: string): Promise<void> =>
  rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }).catch(
    () => undefined,
  );
const sortedNames = (entries: readonly DirectoryEntry[]): string[] =>
  entries.map((entry) => entry.name).sort();
const kindOf = (entries: readonly DirectoryEntry[], name: string): string | undefined =>
  entries.find((entry) => entry.name === name)?.kind;

test('cwd() uses the process directory by default without calling process.chdir', () => {
  const before = process.cwd();
  const reader = new LocalDirectoryReader();
  assert.equal(reader.cwd(), before);
  assert.equal(process.cwd(), before);
});

test('cwd() accepts an injected provider and leaves the process directory alone', () => {
  const before = process.cwd();
  const reader = new LocalDirectoryReader(() => 'C:\\virtual\\workspace');
  assert.equal(reader.cwd(), 'C:\\virtual\\workspace');
  assert.equal(process.cwd(), before);
});

test('lists direct children only and keeps hidden, Unicode and spaced names', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const nested = path.join(directory, 'nested');
  await mkdir(nested);
  await writeFile(path.join(nested, 'child.txt'), 'child', 'utf8');
  await writeFile(path.join(directory, 'a.txt'), 'a', 'utf8');
  await writeFile(path.join(directory, '中文 空格.txt'), 'zh', 'utf8');
  await writeFile(path.join(directory, '.hidden.svg'), '<svg/>', 'utf8');

  const beforeCwd = process.cwd();
  const reader = new LocalDirectoryReader();
  const entries = await reader.list(directory);
  assert.deepEqual(
    sortedNames(entries),
    ['.hidden.svg', 'a.txt', 'nested', '中文 空格.txt'].sort(),
  );
  assert.equal(kindOf(entries, 'nested'), 'directory');
  assert.equal(kindOf(entries, 'a.txt'), 'file');
  assert.equal(kindOf(entries, '.hidden.svg'), 'file');
  assert.equal(kindOf(entries, '中文 空格.txt'), 'file');
  assert.equal(
    entries.some((entry) => entry.name === 'child.txt'),
    false,
  );
  assert.equal(process.cwd(), beforeCwd);
});

test('returns an empty list for an empty directory', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const reader = new LocalDirectoryReader();
  assert.deepEqual(await reader.list(directory), []);
});

test('reports a missing directory with the required wording', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const missing = path.join(directory, 'missing');
  const reader = new LocalDirectoryReader();
  await assert.rejects(reader.list(missing), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.message, `cannot read directory: ${missing}`);
    return true;
  });
});

test('reports a file passed as a directory with the required wording', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const file = path.join(directory, 'plain.txt');
  await writeFile(file, 'not a directory', 'utf8');
  const reader = new LocalDirectoryReader();
  await assert.rejects(reader.list(file), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.message, `cannot read directory: ${file}`);
    return true;
  });
});

test('reports links without following them', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const nested = path.join(directory, 'nested');
  await mkdir(nested);
  const target = path.join(directory, 'target.txt');
  await writeFile(target, 'target', 'utf8');

  let linkName: string | undefined;
  try {
    await symlink(target, path.join(directory, 'link.txt'), 'file');
    linkName = 'link.txt';
  } catch {
    try {
      await symlink(nested, path.join(directory, 'linkdir'), 'junction');
      linkName = 'linkdir';
    } catch {
      t.skip('创建符号链接需要 Windows 开发者模式/管理员权限，当前环境不可用');
      return;
    }
  }

  if (!linkName) {
    t.skip('创建符号链接不可用');
    return;
  }

  const reader = new LocalDirectoryReader();
  const entries = await reader.list(directory);
  assert.equal(kindOf(entries, linkName), 'link');
  assert.equal(
    entries.some((entry) => entry.name === 'child.txt'),
    false,
  );
});
