import type { DecoratedFile, FileBadge } from './DecoratedFile.js';

/**
 * Pure decoration decision: regular SVG file -> `[]`, everything else -> none.
 *
 * The class only reads a plain value, so it can be exercised under `node:test`
 * without the Extension Host. The adapter is responsible for supplying the real
 * host file type and for swallowing I/O errors; this class never throws.
 */
export class SvgFileDecorator {
  private static readonly svgExtension = '.svg';
  private static readonly svgBadge: FileBadge = {
    badge: '[]',
    tooltip: 'SVG document',
  };

  decide(file: DecoratedFile): FileBadge | undefined {
    if (file.scheme !== 'file') return undefined;
    if (file.fileType !== 'file') return undefined;
    if (SvgFileDecorator.extensionOf(file.fsPath) !== SvgFileDecorator.svgExtension)
      return undefined;
    return SvgFileDecorator.svgBadge;
  }

  private static extensionOf(fsPath: string): string {
    const name = fsPath.slice(Math.max(fsPath.lastIndexOf('/'), fsPath.lastIndexOf('\\')) + 1);
    const dot = name.lastIndexOf('.');
    // A leading dot marks a dotfile (`.svg`, `.env`), not an extension.
    return dot <= 0 ? '' : name.slice(dot).toLowerCase();
  }
}
