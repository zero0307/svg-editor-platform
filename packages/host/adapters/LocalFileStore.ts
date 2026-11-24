import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { DomainError, type FileStore } from '@svgframe/core';

/**
 * Real filesystem adapter for the public `FileStore` port.
 *
 * Writes go to a temporary file in the same directory and are then renamed over
 * the target, so a failed write never truncates the existing file. On Windows a
 * rename can fail transiently because an antivirus scanner or indexer still holds
 * the target; those transient codes are retried a bounded number of times while
 * every final failure keeps the Phase 1 error message and cleans the temporary
 * file up.
 */
export class LocalFileStore implements FileStore {
  private static readonly transientCodes = new Set(['EACCES', 'EBUSY', 'EPERM']);
  private static readonly renameAttempts = 5;

  async read(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf8');
    } catch {
      throw new DomainError(`cannot read file: ${path}`);
    }
  }

  async write(path: string, content: string): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
      await this.replace(temporary, path);
    } catch {
      await unlink(temporary).catch(() => undefined);
      throw new DomainError(`cannot write file: ${path}`);
    }
  }

  private async replace(temporary: string, path: string): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temporary, path);
        return;
      } catch (error) {
        if (attempt >= LocalFileStore.renameAttempts - 1 || !LocalFileStore.isTransient(error))
          throw error;
        await sleep(10 * 2 ** attempt);
      }
    }
  }

  private static isTransient(error: unknown): boolean {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' && LocalFileStore.transientCodes.has(code);
  }
}
