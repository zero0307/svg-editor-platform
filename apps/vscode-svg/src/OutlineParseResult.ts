import type { OutlineNode } from './OutlineNode.js';

/**
 * Result of reading SVG source into the neutral outline node.
 *
 * Incomplete or malformed XML is reported through `ok: false`; the host adapter
 * then shows an empty outline and publishes the message, never an exception.
 */
export type OutlineParseResult =
  | { readonly ok: true; readonly root: OutlineNode }
  | { readonly ok: false; readonly message: string };
