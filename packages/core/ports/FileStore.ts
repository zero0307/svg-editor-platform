/**
 * Minimal file port used by edit sessions and host adapters.
 *
 * Read failures and write failures are reported through `DomainError` with the
 * path in the message; implementations own atomic replacement and cleanup. Core
 * code never imports a filesystem implementation.
 */
export interface FileStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}
