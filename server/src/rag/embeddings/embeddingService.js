import { ragConfig } from '../config/ragConfig.js';

export function createGeminiEmbeddingService({ client, model = ragConfig.embeddingModel, dimensions = ragConfig.embeddingDimensions, apiKey = process.env.GEMINI_API_KEY, retries = 2, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let active = client;
  async function getClient() {
    if (!apiKey) throw Object.assign(new Error('Embedding credentials are not configured.'), { code: 'EMBEDDING_NOT_CONFIGURED' });
    if (!active) { const { GoogleGenAI } = await import('@google/genai'); active = new GoogleGenAI({ apiKey }); }
    return active;
  }
  async function embedBatch(texts, taskType = 'RETRIEVAL_DOCUMENT', { signal } = {}) {
    if (!Array.isArray(texts) || !texts.length || texts.some(value => typeof value !== 'string' || !value.trim())) throw Object.assign(new Error('Embedding input must contain non-empty text.'), { code: 'INVALID_EMBEDDING_INPUT' });
    if (signal?.aborted) throw Object.assign(new Error('Embedding cancelled.'), { code: 'CANCELLED' });
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await (await getClient()).models.embedContent({ model, contents: texts, config: { taskType, outputDimensionality: dimensions, ...(signal ? { abortSignal: signal } : {}) } });
        if (signal?.aborted) throw Object.assign(new Error('Embedding cancelled.'), { code: 'CANCELLED' });
        const vectors = response?.embeddings?.map(item => item.values);
        if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some(vector => !Array.isArray(vector) || vector.length !== dimensions || vector.some(value => !Number.isFinite(value)))) throw new Error('Embedding provider returned an invalid vector batch.');
        return vectors;
      } catch (error) {
        if (signal?.aborted || error.code === 'CANCELLED' || error.name === 'AbortError') throw Object.assign(new Error('Embedding cancelled.'), { code: 'CANCELLED', cause: error });
        lastError = error;
        if (['EMBEDDING_NOT_CONFIGURED', 'INVALID_EMBEDDING_INPUT'].includes(error.code)) throw error;
        if (attempt < retries) await sleep(250 * (2 ** attempt));
      }
    }
    throw Object.assign(new Error('Embedding provider request failed.'), { code: 'EMBEDDING_FAILED', cause: lastError });
  }
  return Object.freeze({ embedBatch });
}
const defaultService = createGeminiEmbeddingService();
export const embedTexts = (texts, taskType, options) => defaultService.embedBatch(texts, taskType, options);
