import { createHash } from 'node:crypto';
import { getRedisConfig } from './redisConfig.js';
const prefix = getRedisConfig().keyPrefix;
const safePart = value => String(value).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 100);
export const redisKeys = Object.freeze({
  chatRateLimit(clientId) { return `${prefix}chat:rate:${createHash('sha256').update(String(clientId)).digest('hex')}`; },
  chatRateLimitHash(identityHash) { return `${prefix}chat:rate:${/^[a-f0-9]{64}$/.test(identityHash) ? identityHash : createHash('sha256').update(String(identityHash)).digest('hex')}`; },
  githubRepos(username, options = '') { return `${prefix}github:repos:${safePart(username)}${options ? `:${safePart(options)}` : ''}`; },
  githubReadme(owner, repo) { return `${prefix}github:readme:${safePart(owner)}:${safePart(repo)}`; },
  ragQuery(hash) { return `${prefix}rag:query:${safePart(hash)}`; },
  ragEmbedding(hash) { return `${prefix}rag:embedding:${safePart(hash)}`; },
});
