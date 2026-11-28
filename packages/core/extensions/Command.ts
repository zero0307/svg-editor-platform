import type { CommandToken } from './CommandToken.js';
import type { EditAction } from './EditAction.js';
import type { EditorSessionPort } from '../ports/EditorSessionPort.js';
import type { QueryContext } from './QueryContext.js';

/**
 * Effect of a prepared command, used by the dispatcher to choose the execution
 * path. The decision is metadata only; command names are never inspected.
 *
 * - `query`: read-only snapshot access, no document replacement, history or barrier change
 * - `edit`: exactly one `EditAction` executed on a candidate document, one undo unit
 * - `document`: session-level document lifecycle (`init`/`read`/`save`, canvas resize), may replace the document and set the I/O barrier
 * - `history`: `undo`/`redo`, governed by the existing barrier rules
 */
export type CommandEffect = 'query' | 'edit' | 'document' | 'history';

/** Command feedback; single line or pre-split lines, matching Phase 1 output. */
export type CommandOutput = string | readonly string[];

/** Read-only invocation produced by a `query` command. */
export interface QueryOperation {
  execute(context: QueryContext): CommandOutput | Promise<CommandOutput>;
}

/** Session-level document operation produced by a `document` command. */
export interface DocumentOperation {
  execute(session: EditorSessionPort): CommandOutput | Promise<CommandOutput>;
}

/** Undo/redo invocation produced by a `history` command. */
export interface HistoryOperation {
  execute(session: EditorSessionPort): CommandOutput | Promise<CommandOutput>;
}

export interface PreparationBase {
  /** Whether an initialized/read document must exist before running. */
  readonly requiresDocument: boolean;
}

export interface QueryPreparation extends PreparationBase {
  readonly effect: 'query';
  readonly operation: QueryOperation;
}

export interface EditPreparation extends PreparationBase {
  readonly effect: 'edit';
  readonly action: EditAction;
}

export interface DocumentPreparation extends PreparationBase {
  readonly effect: 'document';
  readonly operation: DocumentOperation;
}

export interface HistoryPreparation extends PreparationBase {
  readonly effect: 'history';
  readonly operation: HistoryOperation;
}

/** Typed preparation result; consumers must switch on `effect`. */
export type CommandPreparation =
  QueryPreparation | EditPreparation | DocumentPreparation | HistoryPreparation;

/**
 * A registered command. It owns parsing, parameter rules and help text, and
 * declares its prerequisites and effect instead of relying on a name whitelist.
 * Implementations are classes or class instances with a stable `name`.
 */
export interface Command {
  /** Stable registration name, for example `create`, `stats` or `dir`. */
  readonly name: string;
  /** Help line, for example `create <type> <id> [params...] [in <containerId>]`. */
  readonly usage: string;
  prepare(args: readonly string[]): CommandPreparation;
  /**
   * Optional token-aware parsing for commands whose grammar depends on quoting
   * (the Phase 1 `create ... in <id>` clause). The dispatcher prefers this over
   * `prepare` when present.
   */
  prepareTokens?(tokens: readonly CommandToken[]): CommandPreparation;
}
