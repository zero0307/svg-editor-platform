import * as vscode from 'vscode';
import type { OutlineSymbol } from './OutlineSymbol.js';
import type { SvgOutlineReader } from './SvgOutlineReader.js';

/**
 * Host adapter for the native Outline.
 *
 * It only converts the neutral symbol tree into `vscode.DocumentSymbol`: offsets
 * become `Position`s through `document.positionAt` (UTF-16 code units, so CJK,
 * emoji and CRLF stay correct), `range` covers the whole element and
 * `selectionRange` is the start tag, which is contained in the range. Parsing
 * happens on every call (edit refresh); unreadable XML yields an empty list and a
 * warning through the injected sink instead of an exception. No outline judgement
 * lives here.
 */
export class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(
    private readonly reader: SvgOutlineReader,
    private readonly warn: (message: string) => void,
  ) {}

  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const reading = this.reader.read(document.getText());
    if (reading.warning !== undefined) this.warn(reading.warning);
    return reading.symbols.map((symbol) => this.symbolOf(document, symbol));
  }

  private symbolOf(document: vscode.TextDocument, symbol: OutlineSymbol): vscode.DocumentSymbol {
    const range = new vscode.Range(
      document.positionAt(symbol.range.start),
      document.positionAt(symbol.range.end),
    );
    const selectionRange = new vscode.Range(
      document.positionAt(symbol.selectionRange.start),
      document.positionAt(symbol.selectionRange.end),
    );
    const detail = symbol.container ? 'container' : '';
    const documentSymbol = new vscode.DocumentSymbol(
      symbol.name,
      detail,
      symbol.container ? vscode.SymbolKind.Object : vscode.SymbolKind.Field,
      range,
      selectionRange,
    );
    documentSymbol.children = symbol.children.map((child) => this.symbolOf(document, child));
    return documentSymbol;
  }
}
