/**
 * Half-open source span in UTF-16 code units: `start` inclusive, `end` exclusive.
 *
 * The neutral syntax entry (`@svgframe/svg-xml`) is the only producer of these
 * offsets; `apps/vscode-svg` converts them to VSCode positions exactly once.
 */
export interface OutlineSpan {
  readonly start: number;
  readonly end: number;
}
