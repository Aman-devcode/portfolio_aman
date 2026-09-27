export class AppError extends Error {
  constructor({ statusCode = 500, code = 'INTERNAL_ERROR', safeMessage = 'Something went wrong.', cause, retryAfter } = {}) {
    super(safeMessage, cause ? { cause } : undefined);
    this.name = 'AppError'; this.statusCode = statusCode; this.code = code; this.safeMessage = safeMessage;
    if (Number.isFinite(retryAfter)) this.retryAfter = retryAfter;
  }
}
