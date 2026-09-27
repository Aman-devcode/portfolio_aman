export function safeChatError(error) {
  if (error?.code === 'RATE_LIMITED') return { code: 'RATE_LIMITED', message: 'Too many requests.' };
  if (['INVALID_MESSAGE', 'MESSAGE_TOO_LARGE'].includes(error?.code)) return { code: error.code, message: error.code === 'MESSAGE_TOO_LARGE' ? 'Please keep your question under 2000 characters.' : 'Please send a valid question.' };
  if (error?.code === 'AI_NOT_CONFIGURED') return { code: 'AI_UNAVAILABLE', message: 'The AI assistant is not configured yet.' };
  if (error?.code === 'CANCELLED') return { code: 'CANCELLED', message: 'Generation cancelled.' };
  if (['VECTOR_DB_NOT_CONFIGURED', 'EMBEDDING_NOT_CONFIGURED', 'EMBEDDING_FAILED', 'VECTOR_DB_REQUEST_FAILED', 'VECTOR_STORE_FAILED', 'VECTOR_COLLECTION_INCOMPATIBLE', 'GENERATION_FAILED'].includes(error?.code)) return { code: 'RAG_UNAVAILABLE', message: 'Portfolio search is temporarily unavailable. Please try again later.' };
  return { code: 'AI_UNAVAILABLE', message: 'The assistant is unavailable right now. Please try again.' };
}
