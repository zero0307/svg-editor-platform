/**
 * Minimal local declaration of the VS Code API this extension uses.
 *
 * #3 intentionally adds no dependency and does not touch the root manifest or
 * lockfile (workspaces arrive with #5). Until `@types/vscode` can be installed,
 * this shim keeps `strict` type checking of the two adapter files honest. #11
 * replaces it with the real `@types/vscode` package and recompiles; see
 * doc/vscode.md.
 */
declare module 'vscode' {
  export type Thenable<T> = PromiseLike<T>;
  export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

  export interface CancellationToken {
    readonly isCancellationRequested: boolean;
  }

  export interface Disposable {
    dispose(): void;
  }

  export class Uri {
    readonly scheme: string;
    readonly path: string;
    readonly fsPath: string;
    static file(path: string): Uri;
  }

  export class FileDecoration {
    badge?: string;
    tooltip?: string;
    color?: unknown;
    propagate?: boolean;
    constructor(badge?: string, tooltip?: string);
  }

  export interface FileDecorationProvider {
    provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration>;
  }

  export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
  }

  export interface FileStat {
    type: FileType;
    ctime: number;
    mtime: number;
    size: number;
  }

  export interface FileSystem {
    stat(uri: Uri): Thenable<FileStat>;
  }

  export namespace workspace {
    const fs: FileSystem;
  }

  export namespace window {
    function registerFileDecorationProvider(provider: FileDecorationProvider): Disposable;
  }
}
