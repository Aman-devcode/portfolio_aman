import { generateAnswer } from '../services/ai/geminiService.js';
import { AppError } from '../errors/AppError.js';

export async function chat(req, res, next) {
  const message = req.body?.message;
  if (typeof message !== 'string' || !message.trim()) return next(new AppError({ statusCode: 400, code: 'INVALID_MESSAGE', safeMessage: 'Please enter a question.' }));
  if (message.length > 2000) return next(new AppError({ statusCode: 413, code: 'MESSAGE_TOO_LARGE', safeMessage: 'Please keep your question under 2000 characters.' }));
  try {
    const result = await generateAnswer(message.trim());
    res.json({ message: result.message, sources: result.sources });
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') return next(new AppError({ statusCode: 503, code: 'AI_UNAVAILABLE', safeMessage: 'The AI assistant is not configured yet.', cause: error }));
    if (error.code === 'VECTOR_DB_NOT_CONFIGURED' || error.code === 'EMBEDDING_NOT_CONFIGURED') return next(new AppError({ statusCode: 503, code: 'RAG_NOT_CONFIGURED', safeMessage: 'Portfolio search is not configured yet.', cause: error }));
    if (['EMBEDDING_FAILED', 'VECTOR_DB_REQUEST_FAILED', 'VECTOR_STORE_FAILED', 'VECTOR_COLLECTION_INCOMPATIBLE', 'GENERATION_FAILED'].includes(error.code)) return next(new AppError({ statusCode: 503, code: 'RAG_UNAVAILABLE', safeMessage: 'Portfolio search is temporarily unavailable. Please try again later.', cause: error }));
    next(new AppError({ statusCode: 503, code: 'AI_UNAVAILABLE', safeMessage: 'The AI assistant is temporarily unavailable.', cause: error }));
  }
}
