import { getRedisHealth } from '../redis/redisHealth.js';
let qdrantState = 'unknown';
export const setQdrantHealth = state => { qdrantState = state; };
export function healthSnapshot() {
  const qdrant = process.env.VECTOR_DB_URL ? qdrantState : 'unavailable';
  const gemini = process.env.GEMINI_API_KEY ? 'configured' : 'unavailable';
  const dependencies = { redis: getRedisHealth(), qdrant, gemini };
  let status = 'ok';
  if (qdrant === 'unavailable' || gemini === 'unavailable') status = 'unavailable';
  else if (qdrant === 'unknown') status = 'degraded';
  return { status, dependencies };
}
