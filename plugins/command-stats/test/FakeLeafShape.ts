import { Shape } from '@svgframe/core';

/**
 * Minimal public leaf shape for `stats` tests: it only exposes the read-only
 * capability the command needs (id, tag, kind, geometry, summary) and never
 * imports builtins, so the plugin is tested without any other plugin package.
 */
export class FakeLeafShape extends Shape {
  readonly tag: string;
  private readonly domainKind: string;
  constructor(id: string, kind: string, tag = kind) {
    super(id);
    this.tag = tag;
    this.domainKind = kind;
  }
  override get kind(): string {
    return this.domainKind;
  }
  override move(_dx: number, _dy: number): void {}
  override scale(_factor: number): void {}
  override clone(): FakeLeafShape {
    return new FakeLeafShape(this.id, this.domainKind, this.tag);
  }
  override geometry(): Readonly<Record<string, string>> {
    return Object.freeze({});
  }
  override summary(): string {
    return '';
  }
}
