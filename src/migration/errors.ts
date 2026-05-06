export class SkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipError';
  }
}
