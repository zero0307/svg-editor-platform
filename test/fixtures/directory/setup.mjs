import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Each caller owns a new temporary parent. Keep scripts and output logs outside it.
export async function createDirectoryFixture(parent) {
  const directory = path.join(parent, '目录 fixture');
  await mkdir(directory);
  await mkdir(path.join(directory, 'empty'));
  await mkdir(path.join(directory, 'nested'));
  await writeFile(path.join(directory, 'nested', 'child.svg'), '');
  await writeFile(path.join(directory, '.hidden'), '');
  await writeFile(path.join(directory, '示例 图.svg'), '');
  return directory;
}
