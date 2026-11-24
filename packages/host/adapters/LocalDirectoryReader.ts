import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import {
  DomainError,
  type DirectoryEntry,
  type DirectoryEntryKind,
  type DirectoryReader,
} from '@svgframe/core';

/**
 * Real directory adapter for the public `DirectoryReader` port.
 *
 * It lists direct children only and never follows symlinks: a link is reported as
 * `kind: 'link'` instead of being resolved. Entries stay in filesystem order; the
 * `dir` command plugin owns sorting and the `[LINK]`/`[OTHER]` labels. `cwd()` uses
 * `process.cwd()` by default and can be injected in tests so no test has to call
 * `process.chdir`.
 */
export class LocalDirectoryReader implements DirectoryReader {
  constructor(private readonly currentDirectory: () => string = () => process.cwd()) {}

  cwd(): string {
    return this.currentDirectory();
  }

  async list(path: string): Promise<readonly DirectoryEntry[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch {
      throw new DomainError(`cannot read directory: ${path}`);
    }
    return entries
      .filter((entry) => entry.name !== '.' && entry.name !== '..')
      .map((entry) => ({ name: entry.name, kind: LocalDirectoryReader.kindOf(entry) }));
  }

  private static kindOf(entry: Dirent): DirectoryEntryKind {
    if (entry.isSymbolicLink()) return 'link';
    if (entry.isDirectory()) return 'directory';
    if (entry.isFile()) return 'file';
    return 'other';
  }
}
