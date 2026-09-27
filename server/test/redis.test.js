import test from 'node:test';
import assert from 'node:assert/strict';
import { getRedisConfig } from '../src/redis/redisConfig.js';
import { redisKeys } from '../src/redis/redisKeys.js';
import { createChatRateLimiter, consumeChatRateLimit } from '../src/services/rateLimiter.js';
import { getCache, setCache, closeRedis, createCacheHelpers } from '../src/redis/redisClient.js';
import { createTieredCache } from '../src/github/githubService.js';

test('Redis configuration is optional and validates URL and prefix', () => {
  assert.equal(getRedisConfig({}).url, '');
  assert.equal(getRedisConfig({ REDIS_URL: 'redis://localhost:6379', REDIS_KEY_PREFIX: 'app:' }).keyPrefix, 'app:');
  assert.equal(getRedisConfig({ REDIS_KEY_PREFIX: 'bad prefix' }).keyPrefix, 'portfolio:');
  assert.equal(getRedisConfig({ REDIS_URL: 'https://example.com' }).url, '');
});

test('Redis keys are prefixed and client IDs are hashed', () => {
  const key = redisKeys.chatRateLimit('192.0.2.1');
  assert.match(key, /^portfolio:chat:rate:[a-f0-9]{64}$/);
  assert.doesNotMatch(key, /192\.0\.2\.1/);
  assert.equal(redisKeys.githubReadme('Owner', 'Repo'), 'portfolio:github:readme:owner:repo');
  assert.match(redisKeys.ragQuery('a'.repeat(64)), /^portfolio:rag:query:/);
});

test('Redis disabled cache helpers safely miss and fail to write', async () => {
  assert.equal(await getCache('portfolio:test'), null);
  assert.equal(await setCache('portfolio:test', { ok: true }, 30), false);
  await closeRedis();
});

test('chat uses distributed limit and returns 429 with Retry-After', async () => {
  const middleware = createChatRateLimiter({ consume: async () => ({ allowed: false, retryAfter: 33, remaining: 0 }) });
  let error;
  await middleware({ ip: '127.0.0.1' }, {}, value => { error = value; });
  assert.equal(error.statusCode, 429); assert.equal(error.retryAfter, 33); assert.equal(error.code, 'RATE_LIMITED');
});

test('chat limiter uses in-memory fallback when Redis is unavailable', async () => {
  const result = await consumeChatRateLimit(`fallback-test-${Date.now()}`, { distributed: async () => null });
  assert.deepEqual(result, { allowed: true, retryAfter: 900, remaining: 19 });
});

test('mock Redis cache supports hits, misses, expiry, malformed data and unavailable fallback', async () => {
  let now = 1000; const data = new Map(); const expiries = new Map(); let deleted = false;
  const redis = {
    async get(key) { if ((expiries.get(key) ?? 0) <= now) return null; return data.get(key) ?? null; },
    async set(key, value, _mode, seconds) { data.set(key, value); expiries.set(key, now + seconds * 1000); },
    async del(key) { deleted = true; data.delete(key); },
  };
  const cache = createCacheHelpers({ clientProvider: () => redis });
  assert.equal(await cache.getCache('k'), null);
  assert.equal(await cache.setCache('k', { value: 1 }, 2), true);
  assert.deepEqual(await cache.getCache('k'), { value: 1 });
  now += 2001; assert.equal(await cache.getCache('k'), null);
  data.set('bad', '{'); expiries.set('bad', now + 2000);
  assert.equal(await cache.getCache('bad'), null); assert.equal(deleted, true);
  const down = createCacheHelpers({ clientProvider: () => null });
  assert.equal(await down.getCache('k'), null); assert.equal(await down.setCache('k', 1, 2), false);
});

test('GitHub tiered cache reads and writes normalized values with TTL', async () => {
  let stored = { normalized: true }; let ttl; let fetched = false;
  const cache = createTieredCache(45, { get: async key => key.includes(':github:repos:') ? stored : null, set: async (_key, _value, seconds) => { ttl = seconds; } });
  const result = await cache.getOrFetch('github:repos:aman:forks-false-archived-false', async () => { fetched = true; return 'upstream'; });
  assert.deepEqual(result, { normalized: true }); assert.equal(fetched, false); assert.equal(ttl, undefined);
  stored = null;
  await cache.getOrFetch('github:readme:aman:repo', async () => ({ content: 'README' }));
  assert.equal(ttl, 45);
});
