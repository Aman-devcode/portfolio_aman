import dotenv from 'dotenv';
import { logger } from '../../observability/logger.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../../../.env') });

export async function ingestPortfolio({ buildDocuments, chunk, embedBatch, store, config, log = logger } = {}) {
  const { buildPortfolioDocuments } = buildDocuments ? {} : await import('../documents/documentBuilder.js');
  const { chunkDocuments } = chunk ? {} : await import('../chunking/chunkDocuments.js');
  const { ragConfig } = config ? {} : await import('../config/ragConfig.js');
  const { embedTexts } = embedBatch ? {} : await import('../embeddings/embeddingService.js');
  const { createVectorStore } = store ? {} : await import('../vectorStore/vectorStore.js');
  const settings = config || ragConfig;
  const documents = (buildDocuments || buildPortfolioDocuments)();
  if (!documents.length) throw Object.assign(new Error('No valid portfolio documents were generated.'), { code: 'EMPTY_CORPUS' });
  const chunks = (chunk || chunkDocuments)(documents, { maxCharacters: settings.maxChunkCharacters, overlapCharacters: settings.overlapCharacters });
  if (!chunks.length) throw Object.assign(new Error('No valid portfolio chunks were generated.'), { code: 'EMPTY_CORPUS' });
  const ids = await import('../retrieval/vectorId.js');
  for (const item of chunks) item.vectorId = ids.vectorIdForChunk(item.id);
  const vectorStore = store || createVectorStore();
  const embed = embedBatch || embedTexts;
  const embeddingStarted = performance.now(); const vectors = [];
  for (let start = 0; start < chunks.length; start += 16) {
    const batch = chunks.slice(start, start + 16);
    vectors.push(...await embed(batch.map(item => `title: ${item.title} | text: ${item.content}`), 'RETRIEVAL_DOCUMENT'));
  }
  if (vectors.length !== chunks.length) throw Object.assign(new Error('Embedding count does not match chunk count.'), { code: 'EMBEDDING_FAILED' });
  log.info('[rag] ingestion embedding complete', { latencyMs: Math.round(performance.now() - embeddingStarted), documents: documents.length, chunks: chunks.length });
  const previousIds = await vectorStore.listCorpusPointIds();
  await vectorStore.upsert(chunks, vectors);
  const activeIds = new Set(chunks.map(item => item.vectorId));
  const staleIds = previousIds.filter(id => !activeIds.has(id));
  await vectorStore.deleteIds(staleIds);
  const summary = { documents: documents.length, chunks: chunks.length, embedded: vectors.length, upserted: chunks.length, deletedStale: staleIds.length };
  log.info('[rag] ingestion complete', summary);
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const missing = [!process.env.GEMINI_API_KEY && 'GEMINI_API_KEY', !process.env.VECTOR_DB_URL && 'VECTOR_DB_URL'].filter(Boolean);
    if (missing.length) throw Object.assign(new Error('RAG ingestion configuration is incomplete.'), { code: 'RAG_NOT_CONFIGURED', missing });
    await ingestPortfolio();
  } catch (error) {
    logger.error('rag.ingestion.failed', { errorCode: error.code || 'INGESTION_FAILED', missingConfiguration: error.missing || [] });
    logger.info(error.code === 'RAG_NOT_CONFIGURED' ? 'rag.ingestion.configuration_required' : 'rag.ingestion.stopped');
    process.exitCode = 1;
  }
}
