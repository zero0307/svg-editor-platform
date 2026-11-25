import { Shape } from '@svgframe/core';

/** Minimal core-only leaf shape used by the command state-invariance test. */
export class FakeRectShape extends Shape {
  readonly tag: string;
  private readonly domainKind: string;
  constructor(id: string, kind = 'rect', tag = kind) {
    super(id);
    this.tag = tag;
    this.domainKind = kind;
  }
  override get kind(): string {
    return this.domainKind;
  }
  override move(_dx: number, _dy: number): void {}
  override scale(_factor: number): void {}
  override clone(): FakeRectShape {
    return new FakeRectShape(this.id, this.domainKind, this.tag);
  }
  override geometry(): Readonly<Record<string, string>> {
    return Object.freeze({});
  }
  override summary(): string {
    return '';
  }
}
