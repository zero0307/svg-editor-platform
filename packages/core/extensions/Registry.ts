import { DomainError } from '../domain/DomainError.js';
import { DuplicateRegistrationError } from './DuplicateRegistrationError.js';

/**
 * Typed registry shared by the four extension points.
 *
 * Contributions keep the registration order (a `Map` insertion order), so help
 * output and decorator suffix order are reproducible. Re-registering an existing
 * key is rejected instead of silently replacing the earlier contribution.
 */
export abstract class Registry<T> {
  private readonly contributions = new Map<string, T>();
  protected abstract keyOf(contribution: T): string;
  /** Noun used in messages, for example `command` or `tree decorator`. */
  protected abstract kind(): string;
  get size(): number {
    return this.contributions.size;
  }
  register(contribution: T): void {
    const key = this.keyOf(contribution);
    if (typeof key !== 'string' || !key.trim() || /\s/.test(key))
      throw new DomainError(`invalid ${this.kind()} registration name: ${String(key)}`);
    if (this.contributions.has(key)) throw new DuplicateRegistrationError(this.kind(), key);
    this.contributions.set(key, contribution);
  }
  get(key: string): T | undefined {
    return this.contributions.get(key);
  }
  require(key: string): T {
    const contribution = this.contributions.get(key);
    if (!contribution) throw this.unknown(key);
    return contribution;
  }
  has(key: string): boolean {
    return this.contributions.has(key);
  }
  entries(): readonly T[] {
    return [...this.contributions.values()];
  }
  names(): readonly string[] {
    return [...this.contributions.keys()];
  }
  /** Extension-specific "not registered" error; override for Phase 1 wording. */
  protected unknown(key: string): DomainError {
    return new DomainError(`unknown ${this.kind()}: ${key}`);
  }
}
