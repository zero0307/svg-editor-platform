/**
 * Read-only projection of one domain node. Queries and decorative extensions only
 * receive this capability, never a mutable live document or shape.
 */
export interface ReadonlyShape {
  readonly id: string;
  /** SVG element name, for example `g` or `rect`. */
  readonly tag: string;
  /** Domain type, for example `rect` or `box`; defaults to `tag` when not overridden. */
  readonly kind: string;
  readonly parent: ReadonlyShape | null;
  children(): readonly ReadonlyShape[];
  /** Presentation attributes in serialization order: imported, geometry, styles. */
  attributes(): Readonly<Record<string, string>>;
  geometry(): Readonly<Record<string, string>>;
  textContent(): string | null;
  /** One-line stable summary used by `tree` and `show`; empty means no suffix. */
  summary(): string;
}
