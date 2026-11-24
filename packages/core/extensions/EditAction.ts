import type { SvgDocument } from '../domain/SvgDocument.js';

/**
 * One domain edit, applied to a detached candidate document by the edit
 * transaction. It has no access to the live document, history stack or I/O.
 *
 * Commands prepare an action; the dispatcher/session decides when to clone,
 * validate, commit and emit `editCommitted`. A failed `apply` must leave the
 * current document and history untouched.
 */
export abstract class EditAction {
  abstract apply(candidate: SvgDocument): string;
}
