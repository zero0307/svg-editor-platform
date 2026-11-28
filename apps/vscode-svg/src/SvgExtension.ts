import * as vscode from 'vscode';
import { SvgDocumentSymbolProvider } from './SvgDocumentSymbolProvider.js';
import { SvgFileDecorator } from './SvgFileDecorator.js';
import { SvgFileDecorationProvider } from './SvgFileDecorationProvider.js';
import { SvgOutlineReader } from './SvgOutlineReader.js';
import { SvgSyntaxOutlineMapper } from './SvgSyntaxOutlineMapper.js';

/**
 * Registration composition root of the extension.
 *
 * `activate` only registers capabilities and keeps the returned disposables;
 * `deactivate` releases exactly what this activation registered, so the Extension
 * Host can unload the extension without leaving providers behind. Outline
 * diagnostics go to a dedicated output channel instead of the extension log.
 * A/B style staging and rollback belong to the CLI plugin loader (#8), not here.
 */
export class SvgExtension {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly decorationProvider: SvgFileDecorationProvider;
  private readonly symbolProvider: SvgDocumentSymbolProvider;

  constructor(
    decorator: SvgFileDecorator = new SvgFileDecorator(),
    mapper: SvgSyntaxOutlineMapper = new SvgSyntaxOutlineMapper(),
  ) {
    const output = vscode.window.createOutputChannel('SVGFrame SVG');
    this.decorationProvider = new SvgFileDecorationProvider(decorator);
    this.symbolProvider = new SvgDocumentSymbolProvider(new SvgOutlineReader(mapper), (message) =>
      output.appendLine(message),
    );
    this.disposables.push(output);
  }

  activate(): void {
    this.disposables.push(vscode.window.registerFileDecorationProvider(this.decorationProvider));
    this.disposables.push(
      vscode.languages.registerDocumentSymbolProvider(
        [{ scheme: 'file', pattern: '**/*.svg' }],
        this.symbolProvider,
      ),
    );
  }

  deactivate(): void {
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
  }
}
