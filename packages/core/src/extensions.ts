import type { DirectoryReader } from './ports.js';
import type {
  CreateShapeRequest,
  DocumentView,
  EditAction,
  EditableDocument,
  EditableShape,
  EditorSessionPort,
  ShapeCreationService,
  ShapeView,
  SvgElementView,
} from './model.js';

export interface ShapeProvider {
  readonly name: string;
  readonly usage: string;
  create(request: CreateShapeRequest, shapes: ShapeCreationService): EditableShape;
  matches(element: SvgElementView): 'kind' | 'tag' | undefined;
  restore(
    element: SvgElementView,
    children: readonly EditableShape[],
    shapes: ShapeCreationService,
  ): EditableShape;
}

export interface AttributeHandler {
  readonly name: string;
  handles(target: ShapeView, attribute: string): boolean;
  apply(candidate: EditableDocument, id: string, attribute: string, value: string): string;
}

export type SessionEvent = {
  readonly type:
    | 'documentInitialized'
    | 'documentRead'
    | 'documentSaved'
    | 'editCommitted'
    | 'undoCommitted'
    | 'redoCommitted'
    | 'canvasChanged';
  readonly document: DocumentView;
};

export type TreeRow =
  | { readonly kind: 'canvas'; readonly document: DocumentView }
  | { readonly kind: 'shape'; readonly shape: ShapeView };

export interface TreeDecorator {
  readonly name: string;
  suffix(row: TreeRow): string | undefined;
  onEvent?(event: SessionEvent): void;
}

export interface QueryContext {
  readonly document?: DocumentView;
  readonly directory: DirectoryReader;
  readonly help: readonly string[];
}
export interface DocumentCommands extends Pick<
  EditorSessionPort,
  'init' | 'read' | 'save' | 'snapshot'
> {
  resize(width: number, height: number): void;
}
export interface HistoryCommands {
  undo(): string;
  redo(): string;
}

export type CommandOutput = string | readonly string[];
type MaybeAsyncOutput = CommandOutput | Promise<CommandOutput>;
export type PreparedCommand =
  | { readonly effect: 'query'; run(context: QueryContext): MaybeAsyncOutput }
  | { readonly effect: 'edit'; readonly action: EditAction }
  | { readonly effect: 'document'; run(context: DocumentCommands): MaybeAsyncOutput }
  | { readonly effect: 'history'; run(context: HistoryCommands): CommandOutput };

export interface CommandArgument {
  readonly value: string;
  readonly quoted: boolean;
}

export interface Command {
  readonly name: string;
  readonly usage: string;
  // The dispatcher checks this before prepare() can report a usage error.
  readonly requiresDocument: boolean;
  prepare(args: readonly CommandArgument[]): PreparedCommand;
}
