import * as vscode from 'vscode';
import { SvgFileDecorator } from './SvgFileDecorator.js';
import { SvgFileDecorationProvider } from './SvgFileDecorationProvider.js';

/**
 * Registration composition root of the extension.
 *
 * `activate` only registers capabilities and keeps the returned disposables;
 * `deactivate` releases exactly what this activation registered, so the
 * Extension Host can unload the extension without leaving providers behind.
 * A/B style staging and rollback belong to the CLI plugin loader (#8), not here.
 */
export class SvgExtension {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly decorationProvider: SvgFileDecorationProvider;

  constructor(decorator: SvgFileDecorator = new SvgFileDecorator()) {
    this.decorationProvider = new SvgFileDecorationProvider(decorator);
  }

  activate(): void {
    this.disposables.push(vscode.window.registerFileDecorationProvider(this.decorationProvider));
  }

  deactivate(): void {
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
  }
}
