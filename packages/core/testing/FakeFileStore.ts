import { DomainError } from '../domain/DomainError.js';
import type { FileStore } from '../ports/FileStore.js';

/**
 * In-memory `FileStore` test double. Tests seed `files`, optionally force a
 * read/write failure, and inspect the content written by a session.
 */
export class FakeFileStore implements FileStore {
  readonly files = new Map<string, string>();
  failRead: string | undefined;
  failWrite: string | undefined;
  async read(path: string): Promise<string> {
    if (this.failRead) throw new DomainError(this.failRead);
    const content = this.files.get(path);
    if (content === undefined) throw new DomainError(`cannot read file: ${path}`);
    return content;
  }
  async write(path: string, content: string): Promise<void> {
    if (this.failWrite) throw new DomainError(this.failWrite);
    this.files.set(path, content);
  }
}
