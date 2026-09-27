import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSocket } from './chatSocket';

class FakeSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  static attempts = 0; static fail = false; static hold = false; static replyError = false; static instances: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  constructor(_url: string | URL) {
    super(); FakeSocket.attempts++; FakeSocket.instances.push(this);
    queueMicrotask(() => {
      if (FakeSocket.fail) { this.onerror?.(new Event('error')); this.readyState = FakeSocket.CLOSED; this.onclose?.(new CloseEvent('close')); }
      else { this.readyState = FakeSocket.OPEN; this.onopen?.(new Event('open')); }
    });
  }
  send(data: string) {
    this.sent.push(data); const request = JSON.parse(data);
    if (request.type === 'chat.start' && FakeSocket.replyError) queueMicrotask(() => this.emit({ type: 'chat.error', requestId: request.requestId, code: 'AI_UNAVAILABLE', message: 'Assistant unavailable' }));
    if (request.type === 'chat.start' && !FakeSocket.hold && !FakeSocket.replyError) queueMicrotask(() => {
      this.emit({ type: 'chat.started', requestId: request.requestId, conversationId: 'conversation' });
      this.emit({ type: 'chat.delta', requestId: request.requestId, delta: 'Hello ' });
      this.emit({ type: 'chat.delta', requestId: request.requestId, delta: 'world' });
      this.emit({ type: 'chat.completed', requestId: request.requestId, message: 'Hello world', sources: [] });
    });
    if (request.type === 'chat.cancel') queueMicrotask(() => this.emit({ type: 'chat.cancelled', requestId: request.requestId }));
  }
  close() { this.readyState = FakeSocket.CLOSED; this.onclose?.(new CloseEvent('close')); }
  emit(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })); }
}

describe('ChatSocket', () => {
  beforeEach(() => {
    FakeSocket.attempts = 0; FakeSocket.fail = false; FakeSocket.hold = false; FakeSocket.replyError = false; FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('connects once and delivers progressive deltas and completion', async () => {
    const state = vi.fn(); const socket = new ChatSocket(state);
    const deltas: string[] = []; const result = await socket.sendMessage('question', delta => deltas.push(delta));
    expect(result?.message).toBe('Hello world'); expect(deltas).toEqual(['Hello ', 'world']);
    expect(FakeSocket.attempts).toBe(1); expect(state).toHaveBeenCalledWith('connected');
    socket.close();
  });

  it('falls back after a bounded number of failed connection attempts', async () => {
    FakeSocket.fail = true; const state = vi.fn(); const socket = new ChatSocket(state, 2);
    expect(await socket.sendMessage('question', () => {})).toBeNull();
    expect(FakeSocket.attempts).toBe(3); expect(state).toHaveBeenLastCalledWith('fallback');
    socket.close();
  });

  it('does not connect while offline and cleans up the connection on close', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const socket = new ChatSocket(); expect(await socket.connect()).toBe(false); expect(FakeSocket.attempts).toBe(0);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await socket.connect(); const active = FakeSocket.instances.at(-1)!; socket.close();
    expect(active.readyState).toBe(FakeSocket.CLOSED);
  });

  it('sends a cancellation message for the active request', async () => {
    FakeSocket.hold = true;
    const socket = new ChatSocket(); const pending = socket.sendMessage('question', () => {});
    await vi.waitFor(() => expect(FakeSocket.instances[0]?.sent.length).toBe(1));
    socket.cancel(); expect(JSON.parse(FakeSocket.instances[0].sent[1]).type).toBe('chat.cancel');
    await expect(pending).resolves.toMatchObject({ message: '' }); socket.close();
  });

  it('surfaces protocol errors without inventing a successful response', async () => {
    FakeSocket.replyError = true; const socket = new ChatSocket();
    await expect(socket.sendMessage('question', () => {})).rejects.toThrow('temporarily unavailable');
    socket.close();
  });

  it('marks a mid-request socket failure for REST fallback', async () => {
    FakeSocket.hold = true; const socket = new ChatSocket(); const pending = socket.sendMessage('question', () => {});
    await vi.waitFor(() => expect(FakeSocket.instances[0]?.sent.length).toBe(1));
    FakeSocket.instances[0].close();
    await expect(pending).rejects.toMatchObject({ fallbackToRest: true }); socket.close();
  });
});
