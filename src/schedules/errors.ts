export class AbortQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortQueryError';
  }
}
