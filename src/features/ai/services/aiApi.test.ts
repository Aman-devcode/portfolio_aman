import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from './aiApi';

afterEach(() => vi.unstubAllGlobals());
describe('AI API error normalization', () => {
  it('maps structured rate-limit errors without showing backend text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'private backend detail' } }), { status: 429 })));
    await expect(sendMessage('question')).rejects.toMatchObject({ kind: 'rate-limited' });
  });
  it('maps AI unavailability and validation errors into stable categories', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message: 'raw provider message' } }), { status: 503 })));
    await expect(sendMessage('question')).rejects.toMatchObject({ kind: 'ai-unavailable' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'INVALID_MESSAGE', message: 'raw validation' } }), { status: 400 })));
    await expect(sendMessage('question')).rejects.toMatchObject({ kind: 'validation-error' });
  });
  it('preserves successful response messages and normalized sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: '  answer ', sources: [{ type: 'project', title: 'Demo', slug: 'demo' }, { type: 1 }] }), { status: 200 })));
    await expect(sendMessage('question')).resolves.toEqual({ message: 'answer', sources: [{ type: 'project', title: 'Demo', slug: 'demo' }] });
  });
  it('normalizes network failures and preserves aborts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('private network details'); }));
    await expect(sendMessage('question')).rejects.toMatchObject({ kind: 'network-error' });
  });
});
