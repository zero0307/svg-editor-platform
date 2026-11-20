// Data-only projections. Producers must isolate them from subsequent edits.
export interface ShapeView {
  readonly id: string;
  readonly kind: string;
  readonly tag: string;
  readonly isContainer: boolean;
  readonly attributes: Readonly<Record<string, string>>;
  readonly text: string | null;
  readonly children: readonly ShapeView[];
}

export interface DocumentView {
  readonly width: number;
  readonly height: number;
  readonly children: readonly ShapeView[];
}

export interface SvgElementView {
  readonly tag: string;
  readonly id?: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly text: string;
  readonly children: readonly SvgElementView[];
}

// Half-open UTF-16 offsets into the original text, including its original line breaks.
export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

export interface LocatedSvgElement extends SvgElementView {
  readonly range: SourceRange;
  readonly nameRange: SourceRange;
  readonly children: readonly LocatedSvgElement[];
}

export interface CreateShapeRequest {
  readonly type: string;
  readonly id: string;
  readonly args: readonly string[];
}

export interface ShapeCreationService {
  create(request: CreateShapeRequest): EditableShape;
}

export interface ShapeContainer {
  readonly children: readonly EditableShape[];
  insert(child: EditableShape, index?: number): void;
  remove(child: EditableShape): void;
  canUngroup(): boolean;
}

// Mutable handles are available only during creation, restoration or a candidate edit.
export interface EditableShape {
  readonly id: string;
  readonly container: ShapeContainer | null;
  snapshot(): ShapeView;
  clone(): EditableShape;
  validateInvariant(): void;
  move(dx: number, dy: number): void;
  scale(factor: number): void;
  setAttribute(name: string, value: string): void;
}

export interface EditableDocument {
  readonly root: ShapeContainer;
  readonly shapes: ShapeCreationService;
  parentOf(id: string): ShapeContainer;
  require(id: string): EditableShape;
  add(shape: EditableShape, parentId?: string): void;
}

export interface EditAction {
  apply(candidate: EditableDocument): string;
}

export interface ReadResult {
  readonly document: DocumentView;
  readonly warnings: readonly string[];
}

export type SvgPresentation = Partial<
  Record<
    | 'fill'
    | 'stroke'
    | 'stroke-width'
    | 'stroke-linecap'
    | 'rx'
    | 'font-size'
    | 'font-family'
    | 'font-weight'
    | 'text-anchor',
    string
  >
>;

export interface SessionShapeRequest extends CreateShapeRequest {
  readonly presentation?: Readonly<SvgPresentation>;
  readonly dataAttributes?: Readonly<Record<`data-${string}`, string>>;
}

// Shared structured operations needed by external applications. Each factory call owns one session.
export interface EditorSessionPort {
  init(width: number, height: number): void;
  snapshot(): DocumentView;
  read(path: string): Promise<ReadResult>;
  create(request: SessionShapeRequest, parentId?: string): void;
  save(path?: string): Promise<{ readonly path: string }>;
}
