import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import { requestId, requestMetrics } from '../src/observability/requestMetrics.js';
import { errorHandler, notFound } from '../src/middleware/errorHandler.js';
import { AppError } from '../src/errors/AppError.js';
import { logger } from '../src/observability/logger.js';
import { incrementMetric, observeDuration, metricsSnapshot, resetMetrics } from '../src/observability/metrics.js';
import { healthSnapshot, setQdrantHealth } from '../src/observability/health.js';
import { getRedisHealth, setRedisState } from '../src/redis/redisHealth.js';
import { safeChatError } from '../src/websocket/websocketErrors.js';

async function serve(instance) {
  const server = instance.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

test('request IDs are validated, generated, returned, and bounded', async () => {
  const instance = express(); instance.use(requestId); instance.get('/', (req, res) => res.json({ requestId: req.requestId }));
  const running = await serve(instance);
  try {
    const validId = randomUUID(); const valid = await fetch(running.base, { headers: { 'X-Request-Id': validId } });
    assert.equal(valid.headers.get('x-request-id'), validId); assert.equal((await valid.json()).requestId, validId);
    const invalid = await fetch(running.base, { headers: { 'X-Request-Id': 'x'.repeat(129) } });
    const returned = invalid.headers.get('x-request-id'); assert.ok(returned); assert.notEqual(returned, 'x'.repeat(129)); assert.match(returned, /^[0-9a-f-]{36}$/i);
  } finally { await running.close(); }
});

test('404 and unexpected errors use safe structured responses and request IDs', async () => {
  const instance = express(); instance.use(requestId); instance.use(requestMetrics);
  instance.get('/fail', () => { throw new Error('private token and provider detail'); }); instance.use(notFound); instance.use(errorHandler);
  const running = await serve(instance);
  try {
    const missing = await fetch(`${running.base}/missing`); const missingBody = await missing.json();
    assert.equal(missing.status, 404); assert.equal(missingBody.error.code, 'NOT_FOUND'); assert.equal(missingBody.error.requestId, missing.headers.get('x-request-id'));
    const failed = await fetch(`${running.base}/fail`); const failedBody = await failed.json();
    assert.equal(failed.status, 500); assert.equal(failedBody.error.code, 'INTERNAL_ERROR'); assert.equal(failedBody.error.requestId, failed.headers.get('x-request-id'));
    assert.doesNotMatch(JSON.stringify(failedBody), /private token|provider detail/);
  } finally { await running.close(); }
});

test('AppError preserves safe status, code and message', async () => {
  const instance = express(); instance.use(requestId); instance.get('/', (_req, _res, next) => next(new AppError({ statusCode: 429, code: 'RATE_LIMITED', safeMessage: 'Slow down.', retryAfter: 8 }))); instance.use(errorHandler);
  const running = await serve(instance);
  try { const response = await fetch(running.base); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '8'); assert.deepEqual((await response.json()).error.code, 'RATE_LIMITED'); }
  finally { await running.close(); }
});

test('structured logger writes JSON and filters sensitive field names', () => {
  const original = console.log; let output = ''; console.log = value => { output = value; };
  try { logger.info('test.event', { requestId: 'req-test', prompt: 'private prompt', apiKey: 'secret', statusCode: 200 }); }
  finally { console.log = original; }
  const record = JSON.parse(output); assert.equal(record.event, 'test.event'); assert.equal(record.requestId, 'req-test'); assert.equal(record.statusCode, 200);
  assert.equal('prompt' in record, false); assert.equal('apiKey' in record, false);
});

test('metrics record safe counters and request duration aggregates', () => {
  resetMetrics(); incrementMetric('ai.requests'); incrementMetric('ai.requests'); observeDuration('http.request', 10); observeDuration('http.request', 20);
  const snapshot = metricsSnapshot(); assert.equal(snapshot.counters['ai.requests'], 2); assert.equal(snapshot.durations['http.request'].count, 2); assert.equal(snapshot.durations['http.request'].averageMs, 15);
  assert.doesNotMatch(JSON.stringify(snapshot), /prompt|token|secret/i);
});

test('health endpoints apply AI-aware readiness while treating Redis as optional', async () => {
  const oldVectorUrl = process.env.VECTOR_DB_URL; const oldGeminiKey = process.env.GEMINI_API_KEY; const oldRedis = getRedisHealth();
  process.env.VECTOR_DB_URL = 'http://qdrant.test'; process.env.GEMINI_API_KEY = 'test-key'; setRedisState('unavailable'); setQdrantHealth('available');
  try {
    const running = await serve(app);
    try {
      const [health, live, ready, metrics] = await Promise.all(['health', 'health/live', 'health/ready', 'metrics'].map(path => fetch(`${running.base}/api/${path}`)));
      assert.equal((await health.json()).status, 'ok'); assert.equal((await live.json()).status, 'ok');
      const readiness = await ready.json(); assert.equal(ready.status, 200); assert.equal(readiness.status, 'ok'); assert.equal(readiness.dependencies.redis, 'unavailable'); assert.equal(readiness.dependencies.qdrant, 'available');
      assert.equal(metrics.status, 200); assert.ok((await metrics.json()).counters);
    } finally { await running.close(); }
    setQdrantHealth('unknown');
    const unknown = healthSnapshot(); assert.equal(unknown.status, 'degraded'); assert.equal(unknown.dependencies.qdrant, 'unknown');
    const notYetReady = await serve(app);
    try { const response = await fetch(`${notYetReady.base}/api/health/ready`); assert.equal(response.status, 503); assert.equal((await response.json()).dependencies.qdrant, 'unknown'); }
    finally { await notYetReady.close(); }
    setQdrantHealth('unavailable');
    const unavailable = await serve(app);
    try { const response = await fetch(`${unavailable.base}/api/health/ready`); assert.equal(response.status, 503); assert.equal((await response.json()).status, 'unavailable'); }
    finally { await unavailable.close(); }
    delete process.env.GEMINI_API_KEY;
    assert.equal(healthSnapshot().status, 'unavailable');
  } finally {
    if (oldVectorUrl === undefined) delete process.env.VECTOR_DB_URL; else process.env.VECTOR_DB_URL = oldVectorUrl;
    if (oldGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGeminiKey;
    setRedisState(oldRedis); setQdrantHealth('unknown');
  }
});

test('WebSocket error mapping returns safe stable categories', () => {
  assert.deepEqual(safeChatError({ code: 'GENERATION_FAILED', message: 'private details' }), { code: 'RAG_UNAVAILABLE', message: 'Portfolio search is temporarily unavailable. Please try again later.' });
  assert.deepEqual(safeChatError(new Error('secret')), { code: 'AI_UNAVAILABLE', message: 'The assistant is unavailable right now. Please try again.' });
});
