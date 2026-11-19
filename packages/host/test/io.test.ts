import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { DomainError, type DirectoryReader, type FileStore } from '@svgframe/core';
import { LocalDirectoryReader, LocalFileStore } from '@svgframe/host';

async function fixture(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'svg-host-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('directory reader lists immediate entries including hidden names and links', async (t) => {
  const root = await fixture(t);
  const initialCwd = process.cwd();
  const reader: DirectoryReader = new LocalDirectoryReader();
  assert.equal(reader.cwd(), initialCwd);
  assert.deepEqual(await reader.list(root), []);
  await mkdir(join(root, '目录'));
  await writeFile(join(root, '目录', 'child.svg'), '');
  await writeFile(join(root, '.hidden'), '');
  await writeFile(join(root, '文件 name.svg'), '');
  await symlink(
    join(root, '目录'),
    join(root, 'alias'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.deepEqual(
    new Map((await reader.list(root)).map((e) => [e.name, e.kind])),
    new Map([
      ['目录', 'directory'],
      ['.hidden', 'file'],
      ['文件 name.svg', 'file'],
      ['alias', 'link'],
    ]),
  );
  assert.equal(process.cwd(), initialCwd);
  assert.equal(reader.cwd(), initialCwd);
});

test(
  'a dangling link remains a link and special entries keep their own kind',
  { skip: process.platform === 'win32' && 'POSIX FIFO and unprivileged file symlink' },
  async (t) => {
    const root = await fixture(t);
    await symlink(join(root, 'absent'), join(root, 'dangling'));
    execFileSync('mkfifo', [join(root, 'pipe')]);
    const entries = await new LocalDirectoryReader().list(root);
    assert.deepEqual(
      new Map(entries.map((e) => [e.name, e.kind])),
      new Map([
        ['dangling', 'link'],
        ['pipe', 'other'],
      ]),
    );
  },
);

test('directory errors report the requested path and permit a subsequent read', async (t) => {
  const root = await fixture(t);
  const reader = new LocalDirectoryReader();
  const file = join(root, 'plain');
  await writeFile(file, '');
  for (const path of [file, join(root, 'missing')]) {
    await assert.rejects(reader.list(path), {
      name: 'DomainError',
      message: 'cannot read directory: ' + path,
    });
  }
  assert.deepEqual(await reader.list(root), [{ name: 'plain', kind: 'file' }]);
});

test('atomic saves support long target names and concurrent replacements contain a complete version', async (t) => {
  const root = await fixture(t);
  const name = 's'.repeat(220) + '.svg';
  const target = join(root, name);
  const store: FileStore = new LocalFileStore();
  await store.write(target, 'original');
  const contents = ['甲', '乙', '丙'].map((c) => c.repeat(4096));
  await Promise.all(contents.map((version) => store.write(target, version)));
  assert.ok(contents.includes(await store.read(target)));
  assert.deepEqual(await readdir(root), [name]);
});

test('failed replacement preserves destination and removes only the temporary file', async (t) => {
  const root = await fixture(t);
  const dir = join(root, 'existing');
  const store = new LocalFileStore();
  await mkdir(dir);
  await writeFile(join(dir, 'keep'), 'original');
  await assert.rejects(store.write(dir, 'invalid'), {
    name: 'DomainError',
    message: 'cannot write file: ' + dir,
  });
  assert.equal(await readFile(join(dir, 'keep'), 'utf8'), 'original');
  assert.deepEqual(await readdir(root), ['existing']);
  await assert.rejects(store.read(join(root, 'absent')), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal((error.cause as NodeJS.ErrnoException).code, 'ENOENT');
    return true;
  });
  await store.write(join(root, 'later.svg'), 'ok');
  assert.equal(await store.read(join(root, 'later.svg')), 'ok');
});
