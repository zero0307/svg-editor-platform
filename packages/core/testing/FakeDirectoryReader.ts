import { DomainError } from '../domain/DomainError.js';
import type { DirectoryEntry, DirectoryReader } from '../ports/DirectoryReader.js';

/**
 * In-memory `DirectoryReader` test double. Tests control the process cwd and the
 * direct entries per path; unknown paths fail with the adapter error wording.
 */
export class FakeDirectoryReader implements DirectoryReader {
  private readonly listings = new Map<string, readonly DirectoryEntry[]>();
  private readonly workingDirectory: string;
  constructor(
    workingDirectory = '/workspace',
    listings: Record<string, readonly DirectoryEntry[]> = {},
  ) {
    this.workingDirectory = workingDirectory;
    for (const [path, entries] of Object.entries(listings)) this.listings.set(path, entries);
  }
  cwd(): string {
    return this.workingDirectory;
  }
  set(path: string, entries: readonly DirectoryEntry[]): void {
    this.listings.set(path, entries);
  }
  async list(path: string): Promise<readonly DirectoryEntry[]> {
    const entries = this.listings.get(path);
    if (!entries) throw new DomainError(`cannot read directory: ${path}`);
    return [...entries];
  }
}
