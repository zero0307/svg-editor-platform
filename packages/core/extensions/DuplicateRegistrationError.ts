import { DomainError } from '../domain/DomainError.js';

/** A contribution tried to reuse a registration name that is already taken. */
export class DuplicateRegistrationError extends DomainError {
  readonly kind: string;
  readonly contributionName: string;
  constructor(kind: string, contributionName: string) {
    super(`duplicate ${kind} registration: ${contributionName}`);
    this.name = 'DuplicateRegistrationError';
    this.kind = kind;
    this.contributionName = contributionName;
  }
}
