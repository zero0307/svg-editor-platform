import { readdir } from 'node:fs/promises';
import { DomainError, type DirectoryEntry, type DirectoryReader } from '@svgframe/core';

export class LocalDirectoryReader implements DirectoryReader {
  cwd(): string {
    return process.cwd();
  }

  async list(path: string): Promise<readonly DirectoryEntry[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map((entry): DirectoryEntry => {
        let kind: DirectoryEntry['kind'] = 'other';
        if (entry.isSymbolicLink()) kind = 'link';
        else if (entry.isDirectory()) kind = 'directory';
        else if (entry.isFile()) kind = 'file';
        return { name: entry.name, kind };
      });
    } catch {
      throw new DomainError(`cannot read directory: ${path}`);
    }
  }
}
