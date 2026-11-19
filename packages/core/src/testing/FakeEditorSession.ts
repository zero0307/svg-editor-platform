import type {
  CreateShapeRequest,
  DocumentView,
  EditorSessionPort,
  ReadResult,
  ShapeView,
} from '../index.js';

// Supply geometry projections for the types under test, without installing shape plugins.
export class FakeEditorSession implements EditorSessionPort {
  private current?: DocumentView;
  private path?: string;
  constructor(
    private readonly project: (request: CreateShapeRequest) => ShapeView,
    private readonly files = new Map<string, DocumentView>(),
  ) {}
  init(width: number, height: number): void {
    this.current = { width, height, children: [] };
    this.path = undefined;
  }
  snapshot(): DocumentView {
    if (!this.current) throw new Error('no document');
    return structuredClone(this.current);
  }
  async read(path: string): Promise<ReadResult> {
    const saved = this.files.get(path);
    if (!saved) throw new Error('cannot read file: ' + path);
    this.current = structuredClone(saved);
    this.path = path;
    return { document: this.snapshot(), warnings: [] };
  }
  create(request: CreateShapeRequest, parentId?: string): void {
    const doc = this.snapshot();
    const shape = structuredClone(this.project(request));
    let inserted = false;
    const add = (node: ShapeView): ShapeView => {
      if (node.id === parentId) {
        if (!node.isContainer) throw new Error('not a container: ' + node.id);
        inserted = true;
        return { ...node, children: [...node.children, shape] };
      }
      return { ...node, children: node.children.map(add) };
    };
    const children = parentId === undefined ? [...doc.children, shape] : doc.children.map(add);
    if (parentId !== undefined && !inserted) throw new Error('no such container: ' + parentId);
    this.current = { ...doc, children };
  }
  async save(path = this.path): Promise<{ readonly path: string }> {
    if (!path) throw new Error('no file path');
    this.files.set(path, this.snapshot());
    this.path ??= path;
    return { path };
  }
}
