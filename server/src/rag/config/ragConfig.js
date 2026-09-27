const supportedDistances = new Set(['Cosine', 'Euclid', 'Dot', 'Manhattan']);
const configuredDistance = process.env.VECTOR_DB_DISTANCE || 'Cosine';
if (!supportedDistances.has(configuredDistance)) throw new Error('VECTOR_DB_DISTANCE must be Cosine, Euclid, Dot, or Manhattan.');

export const ragConfig = Object.freeze({
  embeddingModel: process.env.EMBEDDING_MODEL || 'gemini-embedding-001',
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS) || 768,
  vectorDistance: configuredDistance,
  collection: process.env.VECTOR_DB_COLLECTION || 'aman_portfolio',
  topK: Math.min(Math.max(Number(process.env.RAG_TOP_K) || 5, 1), 12),
  similarityThreshold: Number(process.env.RAG_SIMILARITY_THRESHOLD ?? 0.42),
  maxContextCharacters: 6500,
  maxChunkCharacters: 850,
  overlapCharacters: 100,
});
