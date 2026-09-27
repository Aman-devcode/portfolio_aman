import { ragConfig } from '../config/ragConfig.js';
import { embedTexts } from '../embeddings/embeddingService.js';
import { createVectorStore } from '../vectorStore/vectorStore.js';
import { createHash } from 'node:crypto';
import { getCache, setCache } from '../../redis/redisClient.js';
import { redisKeys } from '../../redis/redisKeys.js';
import { getRedisConfig } from '../../redis/redisConfig.js';
import { logger } from '../../observability/logger.js';
import { incrementMetric, observeDuration } from '../../observability/metrics.js';

export async function retrieveRelevantDocuments(query, { embed = embedTexts, vectorStore = createVectorStore(), config = ragConfig, cacheGet = getCache, cacheSet = setCache, cacheTtlSeconds = getRedisConfig().ragCacheTtlSeconds, signal } = {}) {
  const retrievalStarted = performance.now();
  const throwIfCancelled = () => { if (signal?.aborted) throw Object.assign(new Error('Retrieval cancelled.'), { code: 'CANCELLED' }); };
  throwIfCancelled();
  if (typeof query !== 'string' || !query.trim()) throw Object.assign(new Error('Invalid retrieval query.'), { code: 'INVALID_QUERY', stage: 'validation' });
  const normalizedQuery = query.trim().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
  const identity = JSON.stringify([normalizedQuery, config.topK, config.similarityThreshold, config.embeddingModel, config.embeddingDimensions, config.vectorDistance, config.collection]);
  const hash = createHash('sha256').update(identity).digest('hex');
  const key = redisKeys.ragQuery(hash);
  const cached = await cacheGet(key);
  throwIfCancelled();
  incrementMetric('rag.retrievals');
  if (Array.isArray(cached) && cached.every(item => item && typeof item.content === 'string' && Number.isFinite(item.score))) {
    incrementMetric('rag.cache.hits'); observeDuration('rag.retrieval', performance.now() - retrievalStarted);
    logger.info('rag.retrieval.completed', { cacheHit: true, resultCount: cached.length, noRelevantContext: cached.length === 0, durationMs: Math.round(performance.now() - retrievalStarted) }); return cached;
  }
  incrementMetric('rag.cache.misses'); logger.debug('rag.cache.miss', { cacheHit: false });
  const embeddingStarted = performance.now(); let embeddings;
  try { embeddings = await embed([query.trim()], 'RETRIEVAL_QUERY', { signal }); }
  catch (cause) { logger.warn('embedding.request.failed', { durationMs: Math.round(performance.now() - embeddingStarted), errorCategory: cause.code || 'EMBEDDING_FAILED' }); throw Object.assign(new Error('Query embedding failed.'), { code: cause.code || 'EMBEDDING_FAILED', stage: 'embedding', cause }); }
  throwIfCancelled();
  logger.info('embedding.request.completed', { durationMs: Math.round(performance.now() - embeddingStarted) }); observeDuration('embedding.request', performance.now() - embeddingStarted);
  if (!Array.isArray(embeddings) || embeddings.length !== 1 || !Array.isArray(embeddings[0])) throw Object.assign(new Error('Embedding provider returned an invalid query vector.'), { code: 'EMBEDDING_FAILED', stage: 'embedding' });
  const searchStarted = performance.now(); let matches;
  try { matches = await vectorStore.search(embeddings[0], { limit: config.topK, signal }); }
  catch (cause) { throw Object.assign(new Error('Vector search failed.'), { code: cause.code || 'VECTOR_STORE_FAILED', stage: 'vector_search', cause }); }
  throwIfCancelled();
  if (!Array.isArray(matches)) throw Object.assign(new Error('Vector search returned an invalid result.'), { code: 'VECTOR_STORE_FAILED', stage: 'vector_search' });
  const filtered = matches.filter(item => Number.isFinite(item.score) && item.score >= config.similarityThreshold);
  observeDuration('rag.retrieval', performance.now() - retrievalStarted);
  const normalized = filtered.map(({ type, title, slug, source, score, content }) => ({ type, title, slug, source, score, content }));
  await cacheSet(key, normalized, cacheTtlSeconds);
  throwIfCancelled();
  logger.info('rag.retrieval.completed', { cacheHit: false, resultCount: normalized.length, noRelevantContext: normalized.length === 0, durationMs: Math.round(performance.now() - retrievalStarted) });
  return normalized;
}
