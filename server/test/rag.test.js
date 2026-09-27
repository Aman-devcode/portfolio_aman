import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioDocuments, loadCanonicalPortfolio } from '../src/rag/documents/documentBuilder.js';
import { chunkDocuments } from '../src/rag/chunking/chunkDocuments.js';
import { createGeminiEmbeddingService } from '../src/rag/embeddings/embeddingService.js';
import { buildRAGContext } from '../src/rag/context/buildRAGContext.js';
import { retrieveRelevantDocuments } from '../src/rag/retrieval/retrieveDocuments.js';
import { vectorIdForChunk } from '../src/rag/retrieval/vectorId.js';
import { createVectorStore } from '../src/rag/vectorStore/vectorStore.js';
import { ingestPortfolio } from '../src/rag/ingestion/ingestPortfolio.js';
import { generateAnswer, streamAnswer } from '../src/services/ai/geminiService.js';

test('document builder consumes canonical data and never turns project placeholders into facts', () => {
  const data = loadCanonicalPortfolio();
  const docs = buildPortfolioDocuments(data);
  assert.equal(docs.find(item => item.id === 'skills:backend').metadata.category, 'skills');
  const weather = docs.find(item => item.id === 'project:weathergpt');
  assert.match(weather.content, /No verified project description/);
  assert.doesNotMatch(weather.content, /details pending|Project description not provided/);
  assert.equal(docs.find(item => item.type === 'contact').metadata.slug, 'contact');
  assert.equal(docs.some(item => item.type === 'experience'), false);
  assert.throws(() => buildPortfolioDocuments({ about: {}, skills: [], projects: [], engineering: [] }), /Malformed/);
});

test('chunking is deterministic, bounded, overlapped, and preserves metadata', () => {
  const doc = { id: 'project:demo', type: 'project', title: 'Demo Project', source: 'portfolio', metadata: { slug: 'demo', category: 'project' }, content: `Demo Project. ${'A long verified sentence about project implementation. '.repeat(28)}` };
  const first = chunkDocuments([doc], { maxCharacters: 220, overlapCharacters: 40 });
  const second = chunkDocuments([doc], { maxCharacters: 220, overlapCharacters: 40 });
  assert.deepEqual(first, second);
  assert.ok(first.length > 1);
  assert.ok(first.every(chunk => chunk.content.length <= 220 && chunk.title === 'Demo Project' && chunk.slug === 'demo'));
  assert.throws(() => chunkDocuments([{ id: 'bad', content: 'bad' }]), /Malformed/);
});

test('chunking enforces hard limits for exact, slightly over-limit, and very long sentences', () => {
  const makeDoc = content => ({ id: 'doc:boundary', type: 'project', title: 'Boundary', source: 'portfolio', metadata: { slug: 'boundary', category: 'project' }, content });
  const exact = chunkDocuments([makeDoc('x'.repeat(200))], { maxCharacters: 200, overlapCharacters: 20 });
  assert.equal(exact.length, 1); assert.equal(exact[0].content.length, 200);
  for (const value of ['word '.repeat(41) + 'tail', 'a'.repeat(1200)]) {
    const chunks = chunkDocuments([makeDoc(value)], { maxCharacters: 200, overlapCharacters: 20 });
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(item => item.content.length <= 200));
    assert.ok(chunks.every(item => item.documentId === 'doc:boundary' && item.type === 'project' && item.title === 'Boundary' && item.source === 'portfolio' && item.slug === 'boundary' && item.category === 'project'));
    assert.deepEqual(chunks, chunkDocuments([makeDoc(value)], { maxCharacters: 200, overlapCharacters: 20 }));
  }
  const long = chunkDocuments([makeDoc('a'.repeat(1200))], { maxCharacters: 200, overlapCharacters: 20 }).map(item => item.content);
  assert.equal(long[0] + long.slice(1).map(part => part.slice(20)).join(''), 'a'.repeat(1200));
});

test('Gemini embedding adapter batches inputs, configures retrieval task, and retries transient errors', async () => {
  let calls = 0; let task;
  const client = { models: { async embedContent(options) { calls++; task = options.config.taskType; if (calls === 1) throw new Error('temporary'); return { embeddings: options.contents.map(() => ({ values: [0.1, 0.2, 0.3, 0.4] })) }; } } };
  const service = createGeminiEmbeddingService({ client, apiKey: 'test-key', model: 'fake-model', dimensions: 4, sleep: async () => {} });
  const vectors = await service.embedBatch(['about Aman', 'project details'], 'RETRIEVAL_DOCUMENT');
  assert.equal(vectors.length, 2); assert.equal(calls, 2); assert.equal(task, 'RETRIEVAL_DOCUMENT');
  await assert.rejects(() => createGeminiEmbeddingService({ apiKey: '', dimensions: 4 }).embedBatch(['query']), { code: 'EMBEDDING_NOT_CONFIGURED' });
});

test('Gemini embedding passes through cancellation and does not retry an aborted request', async () => {
  const controller = new AbortController(); let receivedSignal; let calls = 0; let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const service = createGeminiEmbeddingService({ apiKey: 'test-key', dimensions: 2, retries: 2, client: { models: { async embedContent(options) { calls++; receivedSignal = options.config.abortSignal; started(); return new Promise((_resolve, reject) => receivedSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })); } } } });
  const request = service.embedBatch(['query'], 'RETRIEVAL_QUERY', { signal: controller.signal });
  await startedPromise;
  controller.abort();
  await assert.rejects(request, { code: 'CANCELLED' });
  assert.equal(receivedSignal, controller.signal); assert.equal(calls, 1);
});

test('context removes low scores and duplicate text while exposing only source metadata', () => {
  const results = buildRAGContext([
    { score: 0.8, type: 'project', title: 'WeatherGPT', slug: 'weathergpt', content: 'Only title is verified.', vectorId: 'private-id', embedding: [1, 2] },
    { score: 0.7, type: 'project', title: 'WeatherGPT', slug: 'weathergpt', content: 'only title is verified.' },
    { score: 0.1, type: 'experience', title: 'Secret', slug: 'secret', content: 'Low-scoring material.' },
  ], { similarityThreshold: 0.4 });
  assert.equal(results.sources.length, 1); assert.equal(results.results.length, 1);
  assert.doesNotMatch(JSON.stringify(results), /private-id|embedding/);
  assert.match(results.context, /Source: project \| WeatherGPT/);
});

test('retrieval embeds query, searches top K, and filters by threshold', async () => {
  let taskType; let limit;
  const rows = await retrieveRelevantDocuments('What is WeatherGPT?', {
    embed: async (_texts, task) => { taskType = task; return [[0.1, 0.2]]; },
    vectorStore: { search: async (_vector, options) => { limit = options.limit; return [{ score: 0.8, title: 'WeatherGPT', content: 'A listed project.' }, { score: 0.2, title: 'Other', content: 'Not relevant.' }]; } },
    config: { topK: 4, similarityThreshold: 0.5 },
  });
  assert.equal(taskType, 'RETRIEVAL_QUERY'); assert.equal(limit, 4); assert.equal(rows.length, 1);
  await assert.rejects(() => retrieveRelevantDocuments(' ', { embed: async () => [], vectorStore: { search: async () => [] } }), { code: 'INVALID_QUERY' });
});

test('retrieval propagates AbortSignal through embedding and Qdrant search', async () => {
  const controller = new AbortController(); let embeddingSignal; let searchSignal;
  await retrieveRelevantDocuments('signal propagation query', {
    signal: controller.signal,
    cacheGet: async () => null,
    cacheSet: async () => {},
    embed: async (_texts, _task, options) => { embeddingSignal = options.signal; return [[0.1]]; },
    vectorStore: { search: async (_vector, options) => { searchSignal = options.signal; return []; } },
    config: { topK: 3, similarityThreshold: 0.4, embeddingModel: 'fake', embeddingDimensions: 1, collection: 'fake' },
  });
  assert.equal(embeddingSignal, controller.signal); assert.equal(searchSignal, controller.signal);
});

test('RAG cache uses normalized retrieval results and skips repeated embedding and vector search', async () => {
  let calls = 0; let stored;
  const dependencies = {
    embed: async () => { calls++; return [[0.1, 0.2, 0.3, 0.4]]; },
    vectorStore: { async search() { calls++; return [{ type: 'project', title: 'Demo', slug: 'demo', source: 'portfolio', score: 0.8, content: 'Verified content', privateId: 'discard' }]; } },
    cacheGet: async () => stored ?? null,
    cacheSet: async (_key, value, ttl) => { stored = value; assert.equal(ttl, 300); },
  };
  const first = await retrieveRelevantDocuments('  SAME   Query ', dependencies);
  const afterFirst = calls;
  const second = await retrieveRelevantDocuments('same query', dependencies);
  assert.equal(calls, afterFirst); assert.deepEqual(first, second);
  assert.equal(first[0].privateId, undefined);
});

test('ingestion upserts deterministic IDs and removes stale chunks across reruns', async () => {
  let docs = [
    { id: 'about:aman', type: 'about', title: 'About', source: 'portfolio', metadata: { slug: 'about', category: 'about' }, content: 'Aman builds web applications.' },
    { id: 'skills:backend', type: 'skills', title: 'Backend skills', source: 'portfolio', metadata: { slug: 'backend', category: 'skills' }, content: 'Node.js and Express.js are listed.' },
  ];
  const points = new Map();
  const store = { async listCorpusPointIds() { return [...points.keys()]; }, async upsert(chunks, vectors) { chunks.forEach((chunk, i) => points.set(chunk.vectorId, vectors[i])); }, async deleteIds(ids) { ids.forEach(id => points.delete(id)); } };
  const config = { maxChunkCharacters: 850, overlapCharacters: 100 };
  const embed = async texts => texts.map(text => [text.length, 1]);
  const logger = { info() {} };
  const one = await ingestPortfolio({ buildDocuments: () => docs, embedBatch: embed, store, config, log: logger });
  const firstIds = [...points.keys()];
  const two = await ingestPortfolio({ buildDocuments: () => docs, embedBatch: embed, store, config, log: logger });
  assert.deepEqual([...points.keys()], firstIds); assert.equal(two.upserted, one.upserted); assert.equal(two.deletedStale, 0);
  docs = docs.slice(0, 1);
  const three = await ingestPortfolio({ buildDocuments: () => docs, embedBatch: embed, store, config, log: logger });
  assert.equal(points.size, three.chunks); assert.ok(three.deletedStale > 0);
  assert.match(vectorIdForChunk('stable'), /^[0-9a-f-]{36}$/); assert.equal(vectorIdForChunk('stable'), vectorIdForChunk('stable'));
});

test('Qdrant service fails clearly without a database and preserves payload metadata in search', async () => {
  const missing = createVectorStore({ url: '' });
  await assert.rejects(() => missing.search([0.1]), { code: 'VECTOR_DB_NOT_CONFIGURED' });
  const calls = [];
  const mockFetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/collections/test') && init.method !== 'PUT') return new Response('', { status: 404 });
    if (url.includes('/points/query')) return Response.json({ result: { points: [{ score: 0.8, payload: { chunkId: 'project:weather:chunk:001', documentId: 'project:weather', type: 'project', title: 'WeatherGPT', slug: 'weathergpt', content: 'Listed project.' } }] } });
    return Response.json({ result: { points: [] } });
  };
  const service = createVectorStore({ url: 'http://qdrant.test', collection: 'test', fetchImpl: mockFetch, retries: 0 });
  const matches = await service.search([0.1], { limit: 3 });
  assert.equal(matches[0].title, 'WeatherGPT'); assert.ok(calls.some(call => call.init.method === 'PUT'));
});

test('Qdrant creates missing collections with configured vectors and accepts compatible existing collections', async () => {
  const createCalls = [];
  const missing = createVectorStore({ url: 'http://qdrant.test', collection: 'missing', dimensions: 4, distance: 'Cosine', retries: 0, fetchImpl: async (_url, init) => {
    createCalls.push(init);
    if (init.method === 'PUT') return Response.json({ result: true });
    return new Response('', { status: 404 });
  } });
  await missing.ensureCollection();
  assert.deepEqual(JSON.parse(createCalls[1].body).vectors, { size: 4, distance: 'Cosine' });

  const compatible = createVectorStore({ url: 'http://qdrant.test', collection: 'compatible', dimensions: 4, distance: 'Dot', retries: 0, fetchImpl: async () => Response.json({ result: { config: { params: { vectors: { size: 4, distance: 'Dot' } } } } }) });
  await compatible.ensureCollection();
});

test('Qdrant rejects existing collections with wrong dimensions or distance and reports unavailable safely', async () => {
  const existing = (size, distance) => async () => Response.json({ result: { config: { params: { vectors: { size, distance } } } } });
  const wrongSize = createVectorStore({ url: 'http://qdrant.test', dimensions: 4, distance: 'Cosine', retries: 0, fetchImpl: existing(5, 'Cosine') });
  await assert.rejects(() => wrongSize.ensureCollection(), { code: 'VECTOR_COLLECTION_INCOMPATIBLE' });
  const wrongDistance = createVectorStore({ url: 'http://qdrant.test', dimensions: 4, distance: 'Cosine', retries: 0, fetchImpl: existing(4, 'Euclid') });
  await assert.rejects(() => wrongDistance.ensureCollection(), { code: 'VECTOR_COLLECTION_INCOMPATIBLE' });
  const unavailable = createVectorStore({ url: 'http://qdrant.test', retries: 0, fetchImpl: async () => { throw new Error('private upstream detail'); } });
  await assert.rejects(() => unavailable.ensureCollection(), { code: 'VECTOR_DB_REQUEST_FAILED' });
});

test('Qdrant HTTP requests receive and honor retrieval AbortSignal', async () => {
  const controller = new AbortController(); let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const store = createVectorStore({ url: 'http://qdrant.test', retries: 2, fetchImpl: async (_url, options) => {
    assert.equal(options.signal.aborted, false); started();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  } });
  const search = store.search([0.1], { signal: controller.signal });
  await startedPromise; controller.abort();
  await assert.rejects(search, { code: 'CANCELLED' });
});

test('empty retrieval returns the exact no-information response without calling Gemini', async () => {
  const oldKey = process.env.GEMINI_API_KEY; const oldUrl = process.env.VECTOR_DB_URL;
  process.env.GEMINI_API_KEY = 'test-key'; process.env.VECTOR_DB_URL = 'http://qdrant.test';
  try {
    const result = await generateAnswer('What is the capital of France?', { retrieve: async () => [], generate: async () => { throw new Error('must not run'); } });
    assert.equal(result.message, "I don't have that information in Aman's portfolio yet."); assert.deepEqual(result.sources, []);
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldUrl === undefined) delete process.env.VECTOR_DB_URL; else process.env.VECTOR_DB_URL = oldUrl;
  }
});

test('Gemini stream orchestration shares RAG context and emits genuine mocked chunks progressively', async () => {
  const oldKey = process.env.GEMINI_API_KEY; const oldUrl = process.env.VECTOR_DB_URL;
  process.env.GEMINI_API_KEY = 'test-key'; process.env.VECTOR_DB_URL = 'http://qdrant.test';
  try {
    const deltas = [];
    const result = await streamAnswer('Tell me about Demo', {
      retrieve: async () => [{ type: 'project', title: 'Demo', slug: 'demo', score: 0.9, content: 'Verified project details.' }],
      stream: async function* ({ prompt, systemInstruction, model }) {
        assert.match(prompt, /Verified project details/); assert.ok(systemInstruction); assert.equal(model, process.env.GEMINI_MODEL || 'gemini-3.8-flash');
        yield { text: 'Live ' }; yield { text: 'chunks' };
      },
      onDelta: delta => deltas.push(delta),
    });
    assert.deepEqual(deltas, ['Live ', 'chunks']); assert.equal(result.message, 'Live chunks'); assert.equal(result.sources[0].slug, 'demo');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(() => streamAnswer('question', { signal: controller.signal, retrieve: async () => [], stream: async function* () {} }), { code: 'CANCELLED' });
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldUrl === undefined) delete process.env.VECTOR_DB_URL; else process.env.VECTOR_DB_URL = oldUrl;
  }
});

test('WebSocket stream cancellation stops before retrieval, during retrieval, and before Gemini', async () => {
  const oldKey = process.env.GEMINI_API_KEY; const oldUrl = process.env.VECTOR_DB_URL;
  process.env.GEMINI_API_KEY = 'test-key'; process.env.VECTOR_DB_URL = 'http://qdrant.test';
  const rows = [{ score: 0.8, type: 'project', title: 'Demo', slug: 'demo', content: 'A verified project.' }];
  try {
    const alreadyAborted = new AbortController(); alreadyAborted.abort(); let called = false;
    await assert.rejects(() => streamAnswer('question', { signal: alreadyAborted.signal, retrieve: async () => { called = true; return rows; }, stream: async () => { throw new Error('must not generate'); } }), { code: 'CANCELLED' });
    assert.equal(called, false);

    const during = new AbortController(); let retrievalStarted;
    const retrievalStartedPromise = new Promise(resolve => { retrievalStarted = resolve; });
    const inFlight = streamAnswer('question', { signal: during.signal, retrieve: async (_question, { signal }) => new Promise((_resolve, reject) => { retrievalStarted(); signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted mock retrieval'), { code: 'CANCELLED' })), { once: true }); }), stream: async () => { throw new Error('must not generate'); } });
    await retrievalStartedPromise; during.abort();
    await assert.rejects(() => inFlight, { code: 'CANCELLED' });

    const after = new AbortController(); let generated = false;
    await assert.rejects(() => streamAnswer('question', { signal: after.signal, retrieve: async () => { after.abort(); return rows; }, stream: async () => { generated = true; return []; } }), { code: 'CANCELLED' });
    assert.equal(generated, false);
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldUrl === undefined) delete process.env.VECTOR_DB_URL; else process.env.VECTOR_DB_URL = oldUrl;
  }
});
