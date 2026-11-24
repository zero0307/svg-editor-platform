import { DomainError } from './DomainError.js';
import { Numbers } from './Numbers.js';
import { ContainerShape } from './ContainerShape.js';
import { Group } from './Group.js';
import { Shape } from './Shape.js';
import type { EditableDocument } from './EditableDocument.js';
import type { ReadonlyDocument } from './ReadonlyDocument.js';

/**
 * Public document model. Phase 1 names and semantics are kept: `require`,
 * `container`, `add`, `clone`, `validate`, `resize` and the id rules.
 */
export class SvgDocument implements ReadonlyDocument, EditableDocument {
  private canvasWidth: number;
  private canvasHeight: number;
  private rootGroup = new Group('canvas');
  constructor(width = 800, height = 600) {
    this.canvasWidth = Numbers.positive(width, 'width');
    this.canvasHeight = Numbers.positive(height, 'height');
  }
  get width(): number {
    return this.canvasWidth;
  }
  get height(): number {
    return this.canvasHeight;
  }
  get root(): Group {
    return this.rootGroup;
  }
  resize(width: number, height: number): void {
    Numbers.positive(width, 'width');
    Numbers.positive(height, 'height');
    this.canvasWidth = width;
    this.canvasHeight = height;
  }
  all(): readonly Shape[] {
    const result: Shape[] = [];
    const visit = (shape: Shape): void => {
      result.push(shape);
      shape.children().forEach(visit);
    };
    this.root.children().forEach(visit);
    return result;
  }
  find(id: string): Shape | undefined {
    return this.all().find((shape) => shape.id === id);
  }
  require(id: string): Shape {
    const shape = this.find(id);
    if (!shape) throw new DomainError(`no such shape: ${id}`);
    return shape;
  }
  container(id: string): ContainerShape {
    const shape = this.find(id);
    if (!shape) throw new DomainError(`no such container: ${id}`);
    if (!(shape instanceof ContainerShape)) throw new DomainError(`not a container: ${id}`);
    return shape;
  }
  ensureAvailable(id: string): void {
    if (this.find(id)) throw new DomainError(`id already exists: ${id}`);
  }
  add(shape: Shape, parent: ContainerShape = this.root): void {
    const ids = new Set<string>();
    const validate = (node: Shape): void => {
      this.ensureAvailable(node.id);
      if (ids.has(node.id)) throw new DomainError(`id already exists: ${node.id}`);
      ids.add(node.id);
      node.children().forEach(validate);
    };
    validate(shape);
    parent.insert(shape);
  }
  clone(): SvgDocument {
    const copy = new SvgDocument(this.width, this.height);
    copy.rootGroup = this.root.clone();
    return copy;
  }
  /**
   * Full-tree validation: unique ids, acyclic parent links, depth limit and every
   * node's polymorphic invariant. Structural policy is applied by the caller.
   */
  validate(): void {
    const ids = new Set<string>();
    const visited = new Set<Shape>();
    const visit = (shape: Shape, parent: ContainerShape, depth: number): void => {
      if (depth > 128) throw new DomainError('SVG nesting exceeds 128 levels');
      if (visited.has(shape)) throw new DomainError('invalid document: repeated shape or cycle');
      if (shape.parent !== parent)
        throw new DomainError('invalid document: inconsistent parent link');
      if (ids.has(shape.id)) throw new DomainError(`id already exists: ${shape.id}`);
      visited.add(shape);
      ids.add(shape.id);
      shape.validateInvariant();
      if (shape instanceof ContainerShape)
        shape.children().forEach((child) => visit(child, shape, depth + 1));
    };
    this.root.children().forEach((shape) => visit(shape, this.root, 1));
  }
}
