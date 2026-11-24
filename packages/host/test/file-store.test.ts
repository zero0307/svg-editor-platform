import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DomainError } from '@svgframe/core';
import { LocalFileStore } from '../index.js';

const makeDirectory = (): Promise<string> => mkdtemp(path.join(tmpdir(), 'svgframe-host-file-'));
const cleanUp = (directory: string): Promise<void> =>
  rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }).catch(
    () => undefined,
  );
const temporaryFiles = async (directory: string): Promise<string[]> =>
  (await readdir(directory)).filter((name) => name.endsWith('.tmp'));

test('reads an existing UTF-8 file', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const file = path.join(directory, 'plain.txt');
  await writeFile(file, '你好 😀', 'utf8');
  const store = new LocalFileStore();
  assert.equal(await store.read(file), '你好 😀');
});

test('reports a missing file with the Phase 1 wording', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const missing = path.join(directory, 'missing.txt');
  const store = new LocalFileStore();
  await assert.rejects(store.read(missing), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.message, `cannot read file: ${missing}`);
    return true;
  });
});

test('writes a new file and leaves no temporary file behind', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const file = path.join(directory, 'created.svg');
  const store = new LocalFileStore();
  await store.write(file, '<svg/>');
  assert.equal(await readFile(file, 'utf8'), '<svg/>');
  assert.deepEqual(await temporaryFiles(directory), []);
});

test('replaces an existing file atomically', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const file = path.join(directory, 'existing.svg');
  const store = new LocalFileStore();
  await writeFile(file, 'old content', 'utf8');
  await store.write(file, 'new content');
  assert.equal(await readFile(file, 'utf8'), 'new content');
  assert.deepEqual(await temporaryFiles(directory), []);
});

test('keeps the error wording and cleans up when the target is a directory', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const target = path.join(directory, 'target');
  await mkdir(target);
  const store = new LocalFileStore();
  await assert.rejects(store.write(target, 'content'), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.message, `cannot write file: ${target}`);
    return true;
  });
  assert.ok((await stat(target)).isDirectory());
  assert.deepEqual(await temporaryFiles(directory), []);
});

test('reports a write into a missing parent directory and leaves no temporary file', async (t) => {
  const directory = await makeDirectory();
  t.after(() => cleanUp(directory));
  const target = path.join(directory, 'missing', 'file.svg');
  const store = new LocalFileStore();
  await assert.rejects(store.write(target, 'content'), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.message, `cannot write file: ${target}`);
    return true;
  });
  assert.deepEqual(await temporaryFiles(directory), []);
});
