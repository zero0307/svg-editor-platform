import * as vscode from 'vscode';
import type { DecoratedFileType } from './DecoratedFile.js';
import type { SvgFileDecorator } from './SvgFileDecorator.js';

/**
 * Host adapter for the Explorer decoration.
 *
 * It only translates the host types into the neutral input of `SvgFileDecorator`
 * and back; the actual rule lives in the pure class. A missing or unreadable
 * entry (remote URI, deleted file, permission error) yields no decoration
 * instead of an exception, so browsing many directories never throws.
 */
export class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  constructor(private readonly decorator: SvgFileDecorator) {}

  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (uri.scheme !== 'file') return undefined;
    let hostFileType: vscode.FileType;
    try {
      hostFileType = (await vscode.workspace.fs.stat(uri)).type;
    } catch {
      return undefined;
    }
    const badge = this.decorator.decide({
      fsPath: uri.fsPath,
      scheme: uri.scheme,
      fileType: SvgFileDecorationProvider.fileTypeOf(hostFileType),
    });
    if (!badge) return undefined;
    return new vscode.FileDecoration(badge.badge, badge.tooltip);
  }

  private static fileTypeOf(hostFileType: vscode.FileType): DecoratedFileType {
    if (SvgFileDecorationProvider.hasFlag(hostFileType, vscode.FileType.SymbolicLink))
      return 'link';
    if (hostFileType === vscode.FileType.File) return 'file';
    if (hostFileType === vscode.FileType.Directory) return 'directory';
    return 'other';
  }

  private static hasFlag(value: vscode.FileType, flag: vscode.FileType): boolean {
    return (value & flag) === flag;
  }
}
