import { normalizeAIError } from './aiErrors';
import type { ChatSource } from './chatProtocol';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
export { AIServiceError } from './aiErrors';
export async function sendMessage(message: string, signal?: AbortSignal): Promise<{ message: string; sources: ChatSource[] }> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw normalizeAIError('NETWORK_ERROR');
  }
  const result = await response.json().catch(() => null) as { message?: string; error?: string | { code?: string }; sources?: ChatSource[] } | null;
  if (!response.ok) {
    const errorCode = typeof result?.error === 'string' ? result.error : result?.error?.code;
    throw normalizeAIError(errorCode || (response.status === 429 ? 'RATE_LIMITED' : response.status === 400 || response.status === 413 ? 'INVALID_MESSAGE' : 'UNKNOWN_ERROR'));
  }
  if (typeof result?.message !== 'string' || !result.message.trim()) throw normalizeAIError('UNKNOWN_ERROR');
  return { message: result.message.trim(), sources: Array.isArray(result.sources) ? result.sources.filter(source => source && typeof source.title === 'string' && typeof source.type === 'string' && typeof source.slug === 'string') : [] };
}
