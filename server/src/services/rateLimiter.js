import { incrementRateLimit } from '../redis/redisClient.js';
import { redisKeys } from '../redis/redisKeys.js';
import { hashClientIdentity, getHttpClientIdentity } from '../security/clientIdentity.js';
import { AppError } from '../errors/AppError.js';

const memoryLimits = new Map();

export async function consumeChatRateLimit(clientIdentity, { distributed = incrementRateLimit, now = () => Date.now() } = {}) {
  const identityHash = hashClientIdentity(clientIdentity);
  const result = await distributed(redisKeys.chatRateLimitHash(identityHash), 900);
  if (result) return { allowed: result.count <= 20, retryAfter: result.ttl, remaining: Math.max(0, 20 - result.count) };
  const time = now(); let entry = memoryLimits.get(identityHash);
  if (!entry || entry.resetAt <= time) { entry = { count: 0, resetAt: time + 900000 }; memoryLimits.set(identityHash, entry); }
  entry.count++;
  if (memoryLimits.size > 10000) {
    for (const [key, value] of memoryLimits) if (value.resetAt <= time) memoryLimits.delete(key);
    while (memoryLimits.size > 10000) memoryLimits.delete(memoryLimits.keys().next().value);
  }
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - time) / 1000));
  return { allowed: entry.count <= 20, retryAfter, remaining: Math.max(0, 20 - entry.count) };
}

export function createChatRateLimiter({ consume = consumeChatRateLimit } = {}) {
  return async (req, res, next) => {
    const result = await consume(getHttpClientIdentity(req));
    if (!result.allowed) return next(new AppError({ statusCode: 429, code: 'RATE_LIMITED', safeMessage: 'Too many questions in a short time. Please try again in a few minutes.', retryAfter: result.retryAfter }));
    res.set('RateLimit-Limit', '20'); res.set('RateLimit-Remaining', String(result.remaining));
    next();
  };
}
