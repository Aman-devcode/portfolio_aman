import { randomUUID } from 'node:crypto';
import { withLogContext } from './context.js';
import { logger } from './logger.js';
import { incrementMetric, observeDuration } from './metrics.js';

const validRequestId = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
export function requestId(req, res, next) {
  const supplied = req.get('X-Request-Id');
  req.requestId = validRequestId(supplied) ? supplied : randomUUID();
  res.set('X-Request-Id', req.requestId);
  withLogContext({ requestId: req.requestId }, next);
}
export function requestMetrics(req, res, next) {
  const started = performance.now();
  res.once('finish', () => {
    const durationMs = Math.round(performance.now() - started);
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : `/${(req.path || '').split('/').filter(Boolean).slice(0, 2).map((part, index) => index === 0 && part === 'api' ? 'api' : ':segment').join('/')}`;
    incrementMetric('http.requests'); observeDuration('http.request', durationMs);
    const failed = res.statusCode >= 400;
    if (failed) incrementMetric('http.errors');
    logger[failed ? 'warn' : 'info'](failed ? 'http.request.failed' : 'http.request.completed', { method: req.method, route, statusCode: res.statusCode, durationMs, ...(res.locals.errorCode ? { errorCode: res.locals.errorCode } : {}) });
  });
  next();
}
