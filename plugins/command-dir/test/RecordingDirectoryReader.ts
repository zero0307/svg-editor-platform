import { DomainError } from '@svgframe/core';
import type { DirectoryEntry, DirectoryReader } from '@svgframe/core';

/**
 * Recording adapter double: proves `dir` reaches the filesystem only through the
 * public port, with exactly `cwd()` followed by `list(<cwd>)`. It is a test
 * double, so the plugin source still has no Node `fs` or `process.cwd` import.
 */
export class RecordingDirectoryReader implements DirectoryReader {
  readonly calls: string[] = [];
  constructor(
    private readonly workingDirectory: string,
    private readonly entries: readonly DirectoryEntry[] = [],
    private readonly failure?: string,
  ) {}
  cwd(): string {
    this.calls.push('cwd');
    return this.workingDirectory;
  }
  async list(path: string): Promise<readonly DirectoryEntry[]> {
    this.calls.push(`list ${path}`);
    if (this.failure) throw new DomainError(this.failure);
    return [...this.entries];
  }
}
