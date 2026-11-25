import { DomainError, Group } from '@svgframe/core';
import type { Shape } from '@svgframe/core';

/**
 * Composite `box` type: SVG tag `g`, domain kind `box`, serialized with
 * `data-kind="box"`.
 *
 * A box is a container with two necessary role parts whose derived ids are
 * `<id>-rect` and `<id>-label`; any extra children (including nested boxes) are
 * ordinary members. Role parts are resolved by id on every access, so `clone()`
 * (inherited from the public `Group` clone path plus the `newContainer()` hook)
 * automatically rebinds the copied box to its copied parts without sharing mutable
 * children with the source snapshot.
 */
export class BoxShape extends Group {
  constructor(id: string) {
    super(id);
    this.preserveAttribute('data-kind', 'box');
  }
  override get kind(): string {
    return 'box';
  }
  rectId(): string {
    return `${this.id}-rect`;
  }
  labelId(): string {
    return `${this.id}-label`;
  }
  /** The necessary rectangle; throws when the composition is incomplete. */
  rect(): Shape {
    return this.part(this.rectId(), 'rect');
  }
  /** The necessary label; throws when the composition is incomplete. */
  label(): Shape {
    return this.part(this.labelId(), 'text');
  }
  /**
   * Structural policy: the two role parts cannot be deleted or moved out on their
   * own; deleting the whole box stays allowed because that decision belongs to its
   * parent container.
   */
  override canRemoveChild(child: Shape): boolean {
    return child.id !== this.rectId() && child.id !== this.labelId();
  }
  /** A box owns its internal composition, so `ungroup` must refuse it. */
  override canUngroup(): boolean {
    return false;
  }
  /**
   * Every node invariant: the serialization marker stays and both role parts are
   * present with the required element names.
   */
  override validateInvariant(): void {
    if (this.attributes()['data-kind'] !== 'box')
      throw new DomainError(`invalid box: ${this.id} must keep data-kind=box`);
    this.rect();
    this.label();
  }
  /** Retains the actual plugin type while `Group.clone` copies members. */
  protected override newContainer(): BoxShape {
    return new BoxShape(this.id);
  }
  private part(id: string, tag: 'rect' | 'text'): Shape {
    const child = this.children().find((candidate) => candidate.id === id);
    if (!child) throw new DomainError(`incomplete box: ${this.id} is missing ${id}`);
    if (child.tag !== tag) throw new DomainError(`invalid box: ${id} must be a <${tag}> part`);
    return child;
  }
}
