import { DomainError } from '../domain/DomainError.js';
import { ContainerShape } from '../domain/ContainerShape.js';
import { Group } from '../domain/Group.js';
import type { EditableDocument } from '../domain/EditableDocument.js';
import type { Shape } from '../domain/Shape.js';

/**
 * Generic structure operations for the default commands.
 *
 * Every operation goes through the public structural policy first:
 * `ContainerShape.canRemoveChild` / `canInsertChild` guard delete, `addto` and
 * `group`; `Shape.canUngroup` guards `ungroup`. Composite plugins therefore keep
 * their necessary parts without the kernel knowing their names. Operations are
 * applied to the candidate document; callers run them inside an `EditAction`, so
 * a rejected part or a later validation failure leaves the live document intact.
 */
export class StructureService {
  /** Deletes the whole subtree `id`; the direct parent decides whether it may leave. */
  remove(document: EditableDocument, id: string): string {
    const shape = document.require(id);
    const parent = shape.parent;
    if (!parent) throw new DomainError(`cannot remove root: ${id}`);
    if (!parent.canRemoveChild(shape))
      throw new DomainError(`cannot remove necessary part: ${shape.id}`);
    parent.remove(shape);
    return `${shape.kind}#${shape.id} deleted`;
  }
  /** Moves `id` to the end of `containerId`, preserving the child's own subtree. */
  moveTo(document: EditableDocument, id: string, containerId: string): string {
    const target = document.container(containerId);
    const shape = document.require(id);
    const parent = shape.parent;
    if (parent && !parent.canRemoveChild(shape))
      throw new DomainError(`cannot move necessary part: ${shape.id}`);
    if (!target.canInsertChild(shape))
      throw new DomainError(
        `cannot insert ${shape.tag}#${shape.id} into ${target.tag}#${target.id}`,
      );
    target.insert(shape);
    return `${shape.kind}#${shape.id} added to ${target.kind}#${target.id}`;
  }
  /**
   * Groups the given ids into a new `g` container. The insertion point and child
   * order follow Phase 1: document order decides, not the argument order.
   */
  group(document: EditableDocument, id: string, ids: readonly string[]): string {
    document.ensureAvailable(id);
    if (ids.length === 0) throw new DomainError('group requires at least one shape');
    if (new Set(ids).size !== ids.length) throw new DomainError('duplicate shape in group');
    const targets = new Set(ids.map((childId) => document.require(childId)));
    for (const shape of targets) {
      let parent = shape.parent;
      while (parent && parent !== document.root) {
        if (targets.has(parent))
          throw new DomainError(`cannot group a container into its own descendant: ${parent.id}`);
        parent = parent.parent;
      }
    }
    for (const shape of targets) {
      const parent = shape.parent;
      if (parent && !parent.canRemoveChild(shape))
        throw new DomainError(`cannot move necessary part: ${shape.id}`);
    }
    const ordered = document.all().filter((shape) => targets.has(shape));
    let parent: ContainerShape = ordered[0]!.parent!;
    while (!ordered.every((shape) => parent.contains(shape))) parent = parent.parent!;
    let anchor: Shape = ordered[0]!;
    while (anchor.parent !== parent) anchor = anchor.parent!;
    const position = parent.indexOf(anchor);
    const group = new Group(id);
    parent.insert(group, position);
    ordered.forEach((shape) => group.insert(shape));
    return `${group.kind}#${group.id} created with ${ordered.length} children`;
  }
  /**
   * Dissolves a nested ordinary container. Composite containers reject the
   * operation; a top-level group keeps the Phase 1 restriction. Inherited
   * presentation is materialized on children before the container disappears.
   */
  ungroup(document: EditableDocument, id: string): string {
    const shape = document.require(id);
    if (!(shape instanceof ContainerShape)) throw new DomainError(`not a container: ${id}`);
    if (!shape.canUngroup()) throw new DomainError(`cannot ungroup composite shape: ${id}`);
    const parent = shape.parent;
    if (!parent) throw new DomainError(`cannot ungroup root: ${id}`);
    if (parent === document.root)
      throw new DomainError(`cannot ungroup top-level container: ${id}`);
    if (!parent.canRemoveChild(shape))
      throw new DomainError(`cannot remove necessary part: ${shape.id}`);
    let position = parent.indexOf(shape);
    const children = shape.children();
    const inherited = shape.attributes();
    for (const child of children) {
      const own = child.attributes();
      for (const name of Object.keys(StructureService.inheritedDefaults)) {
        const explicitlyInherits = own[name]?.trim().toLowerCase() === 'inherit';
        if ((name in own && !explicitlyInherits) || (!(name in inherited) && !explicitlyInherits))
          continue;
        const value = this.effectiveAttribute(shape, name);
        if (name === 'fill' || name === 'stroke' || name === 'stroke-width')
          child.setAttribute(name, value);
        else child.preserveAttribute(name, value);
      }
      if (!parent.canInsertChild(child))
        throw new DomainError(
          `cannot insert ${child.tag}#${child.id} into ${parent.tag}#${parent.id}`,
        );
      parent.insert(child, position++);
    }
    parent.remove(shape);
    return `${shape.kind}#${shape.id} ungrouped (${children.length} children)`;
  }
  private effectiveAttribute(shape: Shape, name: string): string {
    let current: Shape | null = shape;
    while (current) {
      const value = current.attributes()[name];
      if (value !== undefined && value.trim().toLowerCase() !== 'inherit') return value;
      current = current.parent;
    }
    return StructureService.inheritedDefaults[name]!;
  }
  private static readonly inheritedDefaults: Readonly<Record<string, string>> = {
    fill: 'black',
    stroke: 'none',
    'stroke-width': '1',
    'font-size': 'medium',
    'font-family': 'serif',
    'font-weight': 'normal',
    'font-style': 'normal',
    'text-anchor': 'start',
    'dominant-baseline': 'auto',
    visibility: 'visible',
    color: 'black',
  };
}
