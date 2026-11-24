/** Stable identity of one shape creation requested through the public service. */
export interface ShapeCreationRequest {
  /** Domain type / provider registration name, for example `rect` or `box`. */
  readonly type: string;
  readonly id: string;
  /** Raw parameter tokens owned by the provider's parameter rules. */
  readonly parameters: readonly string[];
}
