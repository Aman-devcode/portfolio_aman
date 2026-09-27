import test from 'node:test';
import assert from 'node:assert/strict';
import { getHttpClientIdentity, getWebSocketClientIdentity, hashClientIdentity, parseTrustProxy, resolveSocketAddress } from '../src/security/clientIdentity.js';
import { consumeChatRateLimit } from '../src/services/rateLimiter.js';

test('client identity uses the direct socket address when proxy trust is disabled', () => {
  assert.equal(resolveSocketAddress('192.0.2.10', '198.51.100.4', false), '192.0.2.10');
  assert.equal(getWebSocketClientIdentity({ socket: { remoteAddress: '192.0.2.10' }, headers: { 'x-forwarded-for': '198.51.100.4' } }, false), '192.0.2.10');
});

test('trusted proxy configuration selects forwarded client according to configured hop count', () => {
  assert.equal(parseTrustProxy('true'), true);
  assert.equal(parseTrustProxy('2'), 2);
  assert.equal(resolveSocketAddress('192.0.2.10', '198.51.100.4, 203.0.113.7', true), '198.51.100.4');
  assert.equal(resolveSocketAddress('192.0.2.10', '198.51.100.4, 203.0.113.7', 1), '203.0.113.7');
  assert.throws(() => parseTrustProxy('localhost'), /TRUST_PROXY/);
});

test('HTTP and WebSocket use the same identity and client IDs are hashed before rate limiting', async () => {
  const request = { ip: '198.51.100.4', socket: { remoteAddress: '192.0.2.10' }, headers: { 'x-forwarded-for': '198.51.100.4' } };
  const httpIdentity = getHttpClientIdentity(request);
  const wsIdentity = getWebSocketClientIdentity(request, true);
  assert.equal(httpIdentity, wsIdentity);
  assert.match(hashClientIdentity(httpIdentity), /^[a-f0-9]{64}$/);
  assert.notEqual(hashClientIdentity(httpIdentity), httpIdentity);
  let usedKey;
  await consumeChatRateLimit(httpIdentity, { distributed: async key => { usedKey = key; return { count: 1, ttl: 900 }; } });
  assert.match(usedKey, /^portfolio:chat:rate:[a-f0-9]{64}$/);
  assert.doesNotMatch(usedKey, /198\.51\.100\.4/);
});
