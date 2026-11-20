import { sessionData, sessionPresentation } from '@svgframe/core';
import type {
  SessionShapeRequest,
  DocumentView,
  EditorSessionPort,
  FileStore,
  ShapeView,
} from '@svgframe/core';
import { ShapeFactory } from '../application/ShapeFactory.js';
import { SvgEditor } from '../application/SvgEditor.js';
import { Group } from '../domain/shapes/Group.js';
import type { Shape } from '../domain/shapes/Shape.js';
import { XmlSvgCodec } from '../infrastructure/XmlSvgCodec.js';

// Public session adapter while the default provider runtime is being migrated in #14.
export class Phase1EditorSession implements EditorSessionPort {
  private readonly factory = new ShapeFactory();
  private readonly editor: SvgEditor;
  constructor(files: FileStore) {
    this.editor = new SvgEditor(files, new XmlSvgCodec(this.factory));
  }
  init(width: number, height: number): void {
    this.editor.init(width, height);
  }
  create(request: SessionShapeRequest, parentId?: string): void {
    // The whole session is private to a tool call. Keep a single candidate until save.
    const doc = this.editor.document();
    const parent = parentId === undefined ? doc.root : doc.container(parentId);
    const shape = this.factory.create(request.type, request.id, request.args);
    for (const [key, value] of Object.entries(sessionData(request)))
      shape.preserveAttribute(key, value);
    for (const [key, value] of Object.entries(sessionPresentation(request))) {
      if (key === 'fill' || key === 'stroke' || key === 'stroke-width')
        shape.setAttribute(key, value);
      else shape.preserveAttribute(key, value);
    }
    doc.add(shape, parent);
  }
  snapshot(): DocumentView {
    const doc = this.editor.document();
    const project = (s: Shape): ShapeView => ({
      id: s.id,
      kind: s.tag,
      tag: s.tag,
      isContainer: s instanceof Group,
      attributes: s.attributes(),
      text: s.textContent(),
      children: s.children().map(project),
    });
    return { width: doc.width, height: doc.height, children: doc.root.children().map(project) };
  }
  async read(path: string) {
    const { warnings } = await this.editor.openFile(path);
    return { document: this.snapshot(), warnings };
  }
  async save(path?: string) {
    this.editor.document().validate();
    return this.editor.saveFile(path);
  }
}
