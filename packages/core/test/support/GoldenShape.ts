import { Shape } from '../../index.js';

/**
 * Test leaf whose presentation strings are supplied verbatim, so the renderer can
 * be asserted against the exact Phase 1 `tree`/`show` output without importing
 * builtins shapes.
 */
export class GoldenShape extends Shape {
  readonly tag: string;
  private readonly values: Readonly<Record<string, string>>;
  private readonly summaryText: string;
  private readonly text: string | null;
  constructor(
    id: string,
    tag: string,
    values: Record<string, string>,
    summary: string,
    text: string | null = null,
  ) {
    super(id);
    this.tag = tag;
    this.values = Object.freeze({ ...values });
    this.summaryText = summary;
    this.text = text;
  }
  override move(_dx: number, _dy: number): void {}
  override scale(_factor: number): void {}
  override geometry(): Readonly<Record<string, string>> {
    return this.values;
  }
  override attributes(): Readonly<Record<string, string>> {
    return this.values;
  }
  override summary(): string {
    return this.summaryText;
  }
  override textContent(): string | null {
    return this.text;
  }
  override clone(): GoldenShape {
    return new GoldenShape(this.id, this.tag, { ...this.values }, this.summaryText, this.text);
  }
}
