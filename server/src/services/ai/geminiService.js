import { SYSTEM_PROMPT } from '../../config/systemPrompt.js';
import { buildPortfolioDocuments } from '../../rag/documents/documentBuilder.js';
import { ragConfig } from '../../rag/config/ragConfig.js';
import { buildRAGContext } from '../../rag/context/buildRAGContext.js';
import { retrieveRelevantDocuments } from '../../rag/retrieval/retrieveDocuments.js';
import { logger } from '../../observability/logger.js';
import { incrementMetric, observeDuration } from '../../observability/metrics.js';

const modelId = () => /^[A-Za-z0-9._/-]{1,120}$/.test(process.env.GEMINI_MODEL || 'gemini-3.8-flash') ? (process.env.GEMINI_MODEL || 'gemini-3.8-flash') : 'configured';
function logChatFailure(error, started, streaming) {
  incrementMetric('ai.errors'); observeDuration('ai.chat', performance.now() - started);
  logger.error('ai.chat.failed', { durationMs: Math.round(performance.now() - started), streaming, errorCategory: error?.code || error?.name || 'AI_UNAVAILABLE' });
}

function throwIfCancelled(signal) {
  if (signal?.aborted) throw Object.assign(new Error('Generation cancelled.'), { code: 'CANCELLED' });
}

function localPortfolioRetrieval(question) {
  const normalizedQuestion = question.toLowerCase().normalize('NFKC');
  const terms = new Set(normalizedQuestion.split(/[^a-z0-9]+/).filter(term => term.length >= 3));
  const documents = buildPortfolioDocuments();

  // Intent-first retrieval is important for broad portfolio questions such as
  // "What projects has Aman built?". Pure lexical matching can otherwise rank
  // generic about/skills documents above project documents.
  const projectIntent = /\b(project|projects|built|build|created|portfolio projects)\b/.test(normalizedQuestion);
  const skillsIntent = /\b(skill|skills|technology|technologies|tech stack|stack)\b/.test(normalizedQuestion);
  const engineeringIntent = /\b(engineering|backend|api|database|redis|authentication|real.?time|ai systems?)\b/.test(normalizedQuestion);
  const contactIntent = /\b(contact|email|e-mail|linkedin|github|reach|hire|hiring|work with|work together|project inquiry|conversation)\b/.test(normalizedQuestion);

  if (contactIntent) {
    return documents
      .filter(document => document.type === 'contact')
      .map(document => ({
        type: document.type,
        title: document.title,
        slug: document.metadata?.slug || document.slug || 'contact',
        source: document.source || 'portfolio',
        content: document.content,
        score: 0.98,
      }));
  }

  if (projectIntent) {
    const projectDocs = documents.filter(document => document.type === 'project');
    const namedTerms = [...terms].filter(term => !['what', 'which', 'project', 'projects', 'built', 'build', 'created', 'aman', 'has'].includes(term));
    return projectDocs
      .map(document => {
        const slug = document.metadata?.slug || document.slug || '';
        const haystack = `${document.title} ${slug} ${document.content}`.toLowerCase();
        const namedHits = namedTerms.filter(term => haystack.includes(term)).length;
        return {
          type: document.type,
          title: document.title,
          slug,
          source: document.source || 'portfolio',
          content: document.content,
          score: Math.min(0.98, 0.86 + namedHits * 0.03),
        };
      })
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }

  if (skillsIntent) {
    return documents
      .filter(document => document.type === 'skills')
      .map(document => ({
        type: document.type,
        title: document.title,
        slug: document.metadata?.slug || document.slug || '',
        source: document.source || 'portfolio',
        content: document.content,
        score: 0.88,
      }));
  }

  if (engineeringIntent) {
    return documents
      .filter(document => document.type === 'engineering')
      .map(document => ({
        type: document.type,
        title: document.title,
        slug: document.metadata?.slug || document.slug || '',
        source: document.source || 'portfolio',
        content: document.content,
        score: 0.88,
      }));
  }

  const ranked = documents.map(document => {
    const slug = document.metadata?.slug || document.slug || '';
    const haystack = `${document.title} ${slug} ${document.content}`.toLowerCase();
    let hits = 0;
    for (const term of terms) if (haystack.includes(term)) hits += 1;
    const titleHit = [...terms].some(term => document.title.toLowerCase().includes(term));
    return {
      type: document.type,
      title: document.title,
      slug,
      source: document.source || 'portfolio',
      content: document.content,
      score: Math.min(0.95, 0.45 + hits * 0.08 + (titleHit ? 0.12 : 0)),
    };
  });

  return ranked
    .filter(item => item.score >= 0.53)
    .sort((a, b) => b.score - a.score)
    .slice(0, ragConfig.topK);
}
async function prepareAnswer(question, retrieve, signal) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('Gemini credentials are not configured.'), { code: 'AI_NOT_CONFIGURED', stage: 'generation' });
  throwIfCancelled(signal);
  let matches;
  if (process.env.VECTOR_DB_URL) {
    matches = await retrieve(question, { signal });
  } else {
    matches = localPortfolioRetrieval(question);
  }
  throwIfCancelled(signal);
  const rag = buildRAGContext(matches, { maxCharacters: ragConfig.maxContextCharacters, similarityThreshold: ragConfig.similarityThreshold });
  if (!rag.results.length) return { message: "I don't have that information in Aman's portfolio yet.", sources: [], empty: true };
  const prompt = `RETRIEVED PORTFOLIO CONTEXT\n\n<context>\n${rag.context}\n</context>\n\nUSER QUESTION\n\n<question>\n${question}\n</question>`;
  return { prompt, sources: rag.sources };
}

export async function generateAnswer(question, { retrieve = retrieveRelevantDocuments, generate } = {}) {
  const chatStarted = performance.now(); incrementMetric('ai.requests'); logger.info('ai.chat.started', { streaming: false, model: modelId() });
  let prepared;
  try { prepared = await prepareAnswer(question, retrieve); } catch (error) { logChatFailure(error, chatStarted, false); throw error; }
  if (prepared.empty) {
    observeDuration('ai.chat', performance.now() - chatStarted); logger.info('ai.chat.completed', { durationMs: Math.round(performance.now() - chatStarted), retrievalUsed: true, sourceCount: 0, streaming: false });
    return { message: prepared.message, sources: prepared.sources };
  }
  const started = performance.now();
  try {
    let text;
    logger.info('gemini.request.started', { streaming: false, model: modelId() });
    if (generate) text = await generate({ prompt: prepared.prompt, systemInstruction: SYSTEM_PROMPT });
    else {
      const { GoogleGenAI } = await import('@google/genai');
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await client.models.generateContent({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash', contents: prepared.prompt, config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2, maxOutputTokens: 350 } });
      text = response.text;
    }
    if (typeof text !== 'string' || !text.trim()) throw new Error('Gemini returned an empty response.');
    const generationMs = Math.round(performance.now() - started);
    logger.info('gemini.request.completed', { streaming: false, model: modelId(), durationMs: generationMs }); observeDuration('gemini.generation', generationMs);
    observeDuration('ai.chat', performance.now() - chatStarted); logger.info('ai.chat.completed', { durationMs: Math.round(performance.now() - chatStarted), retrievalUsed: true, sourceCount: prepared.sources.length, streaming: false });
    return { message: text.trim(), sources: prepared.sources };
  } catch (cause) {
    logger.error('gemini.request.failed', { streaming: false, model: modelId(), durationMs: Math.round(performance.now() - started), errorCategory: cause.code || cause.name || 'GENERATION_FAILED' });
    observeDuration('gemini.generation', performance.now() - started); logChatFailure(cause, chatStarted, false);
    throw Object.assign(new Error('Answer generation failed.'), { code: 'GENERATION_FAILED', stage: 'generation', cause });
  }
}

export async function streamAnswer(question, { retrieve = retrieveRelevantDocuments, stream, signal, onDelta = () => {} } = {}) {
  const chatStarted = performance.now(); incrementMetric('ai.requests'); logger.info('ai.chat.started', { streaming: true, model: modelId() });
  let prepared;
  try { prepared = await prepareAnswer(question, retrieve, signal); } catch (error) {
    if (error.code === 'CANCELLED' || signal?.aborted) { incrementMetric('ai.cancellations'); observeDuration('ai.chat', performance.now() - chatStarted); logger.info('ai.chat.cancelled', { durationMs: Math.round(performance.now() - chatStarted), streaming: true }); throw Object.assign(new Error('Generation cancelled.'), { code: 'CANCELLED', cause: error }); }
    logChatFailure(error, chatStarted, true); throw error;
  }
  if (signal?.aborted) { incrementMetric('ai.cancellations'); observeDuration('ai.chat', performance.now() - chatStarted); logger.info('ai.chat.cancelled', { durationMs: Math.round(performance.now() - chatStarted), streaming: true }); throw Object.assign(new Error('Generation cancelled.'), { code: 'CANCELLED' }); }
  if (prepared.empty) {
    onDelta(prepared.message); observeDuration('ai.chat', performance.now() - chatStarted);
    logger.info('ai.chat.completed', { durationMs: Math.round(performance.now() - chatStarted), retrievalUsed: true, sourceCount: 0, streaming: true });
    return { message: prepared.message, sources: prepared.sources };
  }
  const started = performance.now(); let message = '';
  try {
    let chunks;
    logger.info('gemini.request.started', { streaming: true, model: modelId() });
    if (stream) chunks = await stream({ prompt: prepared.prompt, systemInstruction: SYSTEM_PROMPT, signal, model: process.env.GEMINI_MODEL || 'gemini-3.8-flash' });
    else {
      const { GoogleGenAI } = await import('@google/genai');
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      chunks = await client.models.generateContentStream({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash', contents: prepared.prompt, config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2, maxOutputTokens: 350, ...(signal ? { abortSignal: signal } : {}) } });
    }
    for await (const chunk of chunks) {
      if (signal?.aborted) throw Object.assign(new Error('Generation cancelled.'), { code: 'CANCELLED' });
      const delta = typeof chunk?.text === 'string' ? chunk.text : '';
      if (!delta) continue;
      message += delta; onDelta(delta);
    }
    if (!message.trim()) throw new Error('Gemini returned an empty response.');
    const generationMs = Math.round(performance.now() - started);
    logger.info('gemini.request.completed', { streaming: true, model: modelId(), durationMs: generationMs }); observeDuration('gemini.generation', generationMs);
    observeDuration('ai.chat', performance.now() - chatStarted); logger.info('ai.chat.completed', { durationMs: Math.round(performance.now() - chatStarted), retrievalUsed: true, sourceCount: prepared.sources.length, streaming: true });
    return { message: message.trim(), sources: prepared.sources };
  } catch (cause) {
    if (signal?.aborted || cause.code === 'CANCELLED' || cause.name === 'AbortError') { incrementMetric('ai.cancellations'); observeDuration('gemini.generation', performance.now() - started); observeDuration('ai.chat', performance.now() - chatStarted); logger.info('ai.chat.cancelled', { durationMs: Math.round(performance.now() - chatStarted), streaming: true }); throw Object.assign(new Error('Generation cancelled.'), { code: 'CANCELLED', cause }); }
    logger.error('gemini.request.failed', { streaming: true, model: modelId(), durationMs: Math.round(performance.now() - started), errorCategory: cause.code || cause.name || 'GENERATION_FAILED' });
    observeDuration('gemini.generation', performance.now() - started); logChatFailure(cause, chatStarted, true);
    throw Object.assign(new Error('Answer generation failed.'), { code: 'GENERATION_FAILED', stage: 'generation', cause });
  }
}
