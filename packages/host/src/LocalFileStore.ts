import { randomUUID } from 'node:crypto';
import { open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DomainError, type FileStore } from '@svgframe/core';

export class LocalFileStore implements FileStore {
  async read(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf8');
    } catch {
      throw new DomainError(`cannot read file: ${path}`);
    }
  }

  async write(path: string, content: string): Promise<void> {
    // Keep both names on the same filesystem. A long target name need not also fit a UUID.
    const temporary = join(dirname(path), `.svg-editor-${randomUUID()}.tmp`);
    let owned = false;
    try {
      const handle = await open(temporary, 'wx');
      owned = true;
      try {
        await handle.writeFile(content, 'utf8');
      } finally {
        await handle.close();
      }
      await rename(temporary, path);
    } catch {
      if (owned) await unlink(temporary).catch(() => undefined);
      throw new DomainError(`cannot write file: ${path}`);
    }
  }
}
