import { AppError } from '../errors/AppError.js';
import { logger } from '../observability/logger.js';

export function notFound(req, _res, next) {
  next(new AppError({ statusCode: 404, code: 'NOT_FOUND', safeMessage: 'Route not found.' }));
}
export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  let normalized = error;
  if (error?.type === 'entity.too.large') normalized = new AppError({ statusCode: 413, code: 'BODY_TOO_LARGE', safeMessage: 'The request body is too large.', cause: error });
  else if (error instanceof SyntaxError && 'body' in error) normalized = new AppError({ statusCode: 400, code: 'INVALID_JSON', safeMessage: 'Please send a valid JSON request.', cause: error });
  else if (error?.status === 403) normalized = new AppError({ statusCode: 403, code: 'ORIGIN_NOT_ALLOWED', safeMessage: 'This origin is not allowed.', cause: error });
  const statusCode = normalized instanceof AppError ? normalized.statusCode : 500;
  const appError = normalized instanceof AppError;
  const code = appError ? normalized.code : 'INTERNAL_ERROR';
  const message = appError ? normalized.safeMessage : 'Something went wrong.';
  res.locals.errorCode = code;
  if (normalized.retryAfter) res.set('Retry-After', String(normalized.retryAfter));
  if (statusCode >= 500) logger.error('http.error', { errorCode: code, errorName: error?.name || 'Error' });
  else logger.warn('http.error', { errorCode: code, statusCode });
  res.status(statusCode).json({ error: { code, message, requestId: req.requestId } });
}
