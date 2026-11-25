import { DomainError, Numbers } from '@svgframe/core';

/** Phase 1 argument rules: count validation, values and `argument <n>` numbers. */
export class CommandArguments {
  constructor(
    private readonly args: readonly string[],
    private readonly usage: string,
  ) {}
  get length(): number {
    return this.args.length;
  }
  requireCount(min: number, max = min): void {
    if (this.length < min || this.length > max) throw new DomainError(`usage: ${this.usage}`);
  }
  value(index: number): string {
    const value = this.args[index];
    if (value === undefined) throw new DomainError(`usage: ${this.usage}`);
    return value;
  }
  number(index: number): number {
    return Numbers.parse(this.value(index), `argument ${index + 1}`);
  }
  values(start = 0, end = this.length): readonly string[] {
    return this.args.slice(start, end);
  }
}
