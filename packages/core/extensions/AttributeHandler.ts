import type { EditableDocument } from '../domain/EditableDocument.js';
import type { ReadonlyShape } from '../domain/ReadonlyShape.js';

/** One attribute modification request produced by an attribute-editing command. */
export interface AttributeRequest {
  readonly targetId: string;
  readonly attribute: string;
  readonly value: string;
}

/** Feedback of a successful handler application; the message format stays with the handler. */
export interface AttributeResult {
  readonly message?: string;
}

/**
 * Context handed to `AttributeHandler.apply`. It exposes only the detached
 * candidate document, so handlers modify the working copy through public
 * `require`/container/shape methods. The live document is never reachable here.
 */
export interface AttributeEditContext {
  readonly document: EditableDocument;
}

/**
 * Pluggable attribute semantics, for example box `fill`/`label`.
 *
 * `handles` is a pure query over a read-only shape and must not mutate anything.
 * `apply` runs on the candidate document and may modify several sub-shapes as one
 * edit. If two or more registered handlers match, the framework rejects the
 * request before mutating; with no match it falls back to the shape's default
 * attribute rules; a matched handler failure is propagated without falling back.
 */
export interface AttributeHandler {
  /** Stable registration name, for example `box-attributes`. */
  readonly name: string;
  handles(target: ReadonlyShape, attribute: string): boolean;
  apply(context: AttributeEditContext, request: AttributeRequest): AttributeResult;
}
