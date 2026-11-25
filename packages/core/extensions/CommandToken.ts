/** One parsed command argument; `quoted` preserves CLI quoting where it matters. */
export interface CommandToken {
  readonly value: string;
  readonly quoted: boolean;
}
