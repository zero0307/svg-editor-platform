/** Kind of one direct directory entry; symlinks are not followed. */
export type DirectoryEntryKind = 'directory' | 'file' | 'link' | 'other';

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: DirectoryEntryKind;
}

/**
 * Minimal directory port exposed to commands and plugins. The host adapter backs
 * it with the process working directory and `readdir({ withFileTypes: true })`;
 * plugins never touch the filesystem directly.
 */
export interface DirectoryReader {
  cwd(): string;
  /** Direct children only; implementation runs outside the plugin. */
  list(path: string): Promise<readonly DirectoryEntry[]>;
}
