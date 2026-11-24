/**
 * Platform neutral description of one Explorer entry.
 *
 * The decision layer never receives a `vscode.Uri`: the adapter converts the
 * host type into this plain value first, which keeps the judgement testable
 * with `node:test` and free of the Extension Host.
 */
export type DecoratedFileType = 'file' | 'directory' | 'link' | 'other';

export interface DecoratedFile {
  /** Host path used only for the extension test; never written back. */
  readonly fsPath: string;
  /** URI scheme, for example `file` or `untitled`. */
  readonly scheme: string;
  readonly fileType: DecoratedFileType;
}

/** Explorer decoration decided by the platform neutral layer. */
export interface FileBadge {
  /** Short badge appended by the Explorer, here the literal `[]`. */
  readonly badge: string;
  readonly tooltip: string;
}
