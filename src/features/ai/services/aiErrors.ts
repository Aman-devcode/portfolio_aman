export type AIErrorKind = 'rate-limited' | 'ai-unavailable' | 'network-error' | 'websocket-unavailable' | 'validation-error' | 'unknown-error';
const errors: Record<AIErrorKind, { code: string; message: string }> = {
  'rate-limited': { code: 'RATE_LIMITED', message: 'Too many questions in a short time. Please try again in a few minutes.' },
  'ai-unavailable': { code: 'AI_UNAVAILABLE', message: 'The AI assistant is temporarily unavailable. Please try again later.' },
  'network-error': { code: 'NETWORK_ERROR', message: 'The assistant is unavailable right now. Please check your connection and try again.' },
  'websocket-unavailable': { code: 'WEBSOCKET_UNAVAILABLE', message: 'Live chat is unavailable.' },
  'validation-error': { code: 'INVALID_MESSAGE', message: 'Please check your question and try again.' },
  'unknown-error': { code: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' },
};
export class AIServiceError extends Error {
  readonly kind: AIErrorKind;
  readonly code: string;
  readonly fallbackToRest: boolean;
  constructor(kind: AIErrorKind, code = errors[kind].code, fallbackToRest = false) { super(errors[kind].message); this.name = 'AIServiceError'; this.kind = kind; this.code = code; this.fallbackToRest = fallbackToRest; }
}
export function normalizeAIError(code: string): AIServiceError {
  if (code === 'RATE_LIMITED') return new AIServiceError('rate-limited', code);
  if (['AI_UNAVAILABLE', 'AI_NOT_CONFIGURED', 'RAG_NOT_CONFIGURED', 'RAG_UNAVAILABLE'].includes(code)) return new AIServiceError('ai-unavailable', code, true);
  if (['INVALID_MESSAGE', 'MESSAGE_TOO_LARGE', 'BODY_TOO_LARGE', 'INVALID_JSON'].includes(code)) return new AIServiceError('validation-error', code);
  if (code === 'WEBSOCKET_ERROR' || code === 'WEBSOCKET_UNAVAILABLE') return new AIServiceError('websocket-unavailable', code);
  if (code === 'NETWORK_ERROR') return new AIServiceError('network-error', code, true);
  return new AIServiceError('unknown-error', code);
}
