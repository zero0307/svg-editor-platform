/**
 * Half-open source span: `start` inclusive, `end` exclusive.
 *
 * Offsets are 0-based UTF-16 code unit indices into the parsed source string,
 * exactly like JavaScript string indices. They are not byte offsets and not
 * line/column positions; `apps/vscode-svg` converts them to its own UTF-16
 * `Position`/`Range` values. This convention also holds for CJK characters,
 * emoji (surrogate pairs) and CRLF line endings.
 */
export interface SvgSyntaxSpan {
  readonly start: number;
  readonly end: number;
}
