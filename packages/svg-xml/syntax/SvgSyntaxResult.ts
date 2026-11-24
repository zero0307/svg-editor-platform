import type { SvgSyntaxElement } from './SvgSyntaxElement.js';

/**
 * Result of `parseSvgSyntax`. Incomplete or malformed XML is reported through
 * the `ok: false` branch and never escapes as an uncaught exception; callers such
 * as the VSCode Outline may show an empty outline and keep working.
 */
export type SvgSyntaxResult =
  | { readonly ok: true; readonly root: SvgSyntaxElement }
  | { readonly ok: false; readonly message: string };
