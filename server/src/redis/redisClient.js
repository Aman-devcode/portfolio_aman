import Redis from 'ioredis';
import { getRedisConfig } from './redisConfig.js';
import { setRedisState, getRedisHealth } from './redisHealth.js';
import { logger } from '../observability/logger.js';
import { setGauge } from '../observability/metrics.js';

const config = getRedisConfig();
let client;
let unavailableLogged = false;
let hasConnected = false;
if (!config.url) setGauge('redis.available', 0);
export function getRedisClient() {
  if (!config.url) return null;
  if (!client) {
    client = new Redis(config.url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 1500, commandTimeout: 1200, retryStrategy(times) { return times <= 2 ? times * 500 : null; } });
    client.on('ready', () => {
      setRedisState('connected'); setGauge('redis.available', 1);
      logger.info(hasConnected ? 'redis.reconnected' : 'redis.connected'); hasConnected = true; unavailableLogged = false;
    });
    client.on('error', () => {
      const previous = getRedisHealth(); setRedisState('unavailable'); setGauge('redis.available', 0);
      if (!unavailableLogged) logger.warn(previous === 'connected' ? 'redis.unavailable' : 'redis.error', { fallback: 'in-memory' });
      unavailableLogged = true;
    });
    client.on('close', () => { const previous = getRedisHealth(); setRedisState('unavailable'); setGauge('redis.available', 0); if (previous === 'connected') logger.warn('redis.unavailable', { fallback: 'in-memory' }); });
    client.connect().catch(() => { setRedisState('unavailable'); setGauge('redis.available', 0); });
  }
  return client.status === 'ready' ? client : null;
}
export async function closeRedis() {
  if (!client) return;
  const active = client; client = null; setRedisState('unavailable');
  try { if (active.status === 'ready') await active.quit(); else active.disconnect(); } catch { active.disconnect(); }
}
export function createCacheHelpers({ clientProvider = getRedisClient, onUnavailable = () => setRedisState('unavailable') } = {}) {
  return Object.freeze({
    async getCache(key) {
      try {
        const redis = clientProvider(); if (!redis) return null;
        const raw = await redis.get(key); if (raw === null) return null;
        try { return JSON.parse(raw); } catch { await redis.del(key).catch(() => {}); return null; }
      } catch { onUnavailable(); return null; }
    },
    async setCache(key, value, ttlSeconds) {
      try { const redis = clientProvider(); if (!redis) return false; await redis.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds))); return true; }
      catch { onUnavailable(); return false; }
    },
    async deleteCache(key) {
      try { const redis = clientProvider(); if (!redis) return false; await redis.del(key); return true; }
      catch { onUnavailable(); return false; }
    },
  });
}
const cacheHelpers = createCacheHelpers();
export const getCache = (...args) => cacheHelpers.getCache(...args);
export const setCache = (...args) => cacheHelpers.setCache(...args);
export const deleteCache = (...args) => cacheHelpers.deleteCache(...args);
export async function incrementRateLimit(key, windowSeconds) {
  try {
    const redis = getRedisClient(); if (!redis) return null;
    const result = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return {n,redis.call('TTL',KEYS[1])}", 1, key, windowSeconds);
    return { count: Number(result[0]), ttl: Math.max(1, Number(result[1])) };
  } catch { setRedisState('unavailable'); return null; }
}
