import { describe, expect, it } from 'vitest';
import { normalizeAIError } from './aiErrors';

describe('AI error normalization', () => {
  it.each([
    ['RATE_LIMITED', 'rate-limited'], ['AI_UNAVAILABLE', 'ai-unavailable'], ['NETWORK_ERROR', 'network-error'],
    ['WEBSOCKET_ERROR', 'websocket-unavailable'], ['INVALID_MESSAGE', 'validation-error'], ['unknown', 'unknown-error'],
  ] as const)('maps %s to %s without backend details', (code, kind) => {
    const error = normalizeAIError(code);
    expect(error.kind).toBe(kind); expect(error.message).not.toContain(code);
  });
});
