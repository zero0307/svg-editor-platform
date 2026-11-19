export interface FileStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: 'directory' | 'file' | 'link' | 'other';
}

export interface DirectoryReader {
  cwd(): string;
  list(path: string): Promise<readonly DirectoryEntry[]>;
}
