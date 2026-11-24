/** Expected, user-facing failure of a domain or contract operation. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
