import { randomUUID } from 'node:crypto';
import { open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DomainError, type FileStore } from '@svgframe/core';

export class LocalFileStore implements FileStore {
  async read(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf8');
    } catch (cause) {
      throw new DomainError(`cannot read file: ${path}`, { cause });
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
      await this.replace(temporary, path);
    } catch (cause) {
      if (owned) await unlink(temporary).catch(() => undefined);
      throw new DomainError(`cannot write file: ${path}`, { cause });
    }
  }

  private async replace(temporary: string, target: string): Promise<void> {
    // Concurrent Windows replacements can briefly deny delete sharing on the target.
    for (const waitMs of [10, 25, 50, 100, 200]) {
      try {
        return await rename(temporary, target);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? ''))
          throw error;
        await delay(waitMs);
      }
    }
    await rename(temporary, target);
  }
}
