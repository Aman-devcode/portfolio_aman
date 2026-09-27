export function getRedisConfig(env = process.env) {
  const redisUrl = (env.REDIS_URL || '').trim();
  if (redisUrl) {
    let parsed;
    try { parsed = new URL(redisUrl); } catch { return Object.freeze({ url: '', keyPrefix: 'portfolio:', ragCacheTtlSeconds: 300 }); }
    if (!['redis:', 'rediss:'].includes(parsed.protocol)) return Object.freeze({ url: '', keyPrefix: 'portfolio:', ragCacheTtlSeconds: 300 });
  }
  const ttl = Number(env.RAG_CACHE_TTL_SECONDS);
  const prefix = (env.REDIS_KEY_PREFIX || 'portfolio:').trim();
  return Object.freeze({ url: redisUrl, keyPrefix: /^[A-Za-z0-9:_-]{1,64}$/.test(prefix) ? prefix : 'portfolio:', ragCacheTtlSeconds: Number.isFinite(ttl) && ttl >= 0 ? Math.min(Math.floor(ttl), 86400) : 300 });
}
