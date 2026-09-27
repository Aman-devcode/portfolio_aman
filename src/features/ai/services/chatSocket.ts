import type { ChatSocketMessage, ChatSource } from './chatProtocol';
import { normalizeAIError } from './aiErrors';
export type SocketState = 'connecting' | 'connected' | 'fallback';
type Pending = { onDelta: (delta: string) => void; resolve: (value: { message: string; sources: ChatSource[] } | null) => void; reject: (error: Error) => void; partial: string };

export class ChatSocket {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private connectPromise: Promise<boolean> | null = null;
  private closed = false;
  private failures = 0;
  constructor(private onState: (state: SocketState) => void = () => {}, private maxRetries = 3) {}

  async connect(): Promise<boolean> {
    if (this.closed || !('WebSocket' in window) || !navigator.onLine) { this.onState('fallback'); return false; }
    if (this.socket?.readyState === WebSocket.OPEN) return true;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connectAttempts().finally(() => { this.connectPromise = null; });
    return this.connectPromise;
  }
  private async connectAttempts(): Promise<boolean> {
    this.onState('connecting');
    while (!this.closed && this.failures <= this.maxRetries && navigator.onLine) {
      const address = new URL(import.meta.env.VITE_API_BASE_URL || window.location.origin, window.location.href);
      address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:'; address.pathname = '/ws/chat'; address.search = ''; address.hash = '';
      const opened = await new Promise<boolean>(resolve => {
        let settled = false; let socket: WebSocket;
        try { socket = new WebSocket(address); } catch { resolve(false); return; }
        this.socket = socket;
        const timer = window.setTimeout(() => { if (!settled) { settled = true; socket.close(); resolve(false); } }, 2500);
        socket.onopen = () => { if (settled) return; settled = true; window.clearTimeout(timer); this.failures = 0; this.onState('connected'); resolve(true); };
        socket.onmessage = event => this.handleMessage(event.data);
        socket.onerror = () => { if (!settled) { settled = true; window.clearTimeout(timer); socket.close(); resolve(false); } };
        socket.onclose = () => { if (!settled) { settled = true; window.clearTimeout(timer); resolve(false); } this.socket = null; this.failPending(); if (!this.closed) this.onState('fallback'); };
      });
      if (opened) return true;
      this.failures++;
      if (this.failures <= this.maxRetries && navigator.onLine) await new Promise(resolve => window.setTimeout(resolve, 150 * (2 ** (this.failures - 1))));
    }
    this.onState('fallback'); return false;
  }
  async sendMessage(message: string, onDelta: (delta: string) => void): Promise<{ message: string; sources: ChatSource[] } | null> {
    if (!await this.connect() || this.socket?.readyState !== WebSocket.OPEN) return null;
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { onDelta, resolve, reject, partial: '' });
      try { this.socket!.send(JSON.stringify({ type: 'chat.start', requestId, message })); }
      catch { this.pending.delete(requestId); resolve(null); }
    });
  }
  cancel(requestId?: string) {
    const id = requestId || this.pending.keys().next().value;
    if (id && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'chat.cancel', requestId: id }));
  }
  close() {
    this.closed = true;
    for (const id of this.pending.keys()) this.cancel(id);
    this.socket?.close(1000, 'Chat closed'); this.socket = null; this.failPending();
  }
  private handleMessage(data: unknown) {
    let event: ChatSocketMessage;
    try { event = JSON.parse(String(data)) as ChatSocketMessage; } catch { return; }
    const requestId = 'requestId' in event && typeof event.requestId === 'string' ? event.requestId : null;
    const pending = requestId ? this.pending.get(requestId) : undefined;
    if (!pending) return;
    if (event.type === 'chat.delta') { pending.partial += event.delta; pending.onDelta(event.delta); }
    else if (event.type === 'chat.completed') { this.pending.delete(event.requestId); pending.resolve({ message: event.message, sources: event.sources || [] }); }
    else if (event.type === 'chat.cancelled') { this.pending.delete(event.requestId); pending.resolve({ message: pending.partial, sources: [] }); }
    else if (event.type === 'chat.error') { this.pending.delete(requestId!); pending.reject(normalizeAIError(event.code)); }
  }
  private failPending() { for (const [id, pending] of this.pending) { this.pending.delete(id); pending.reject(Object.assign(normalizeAIError('NETWORK_ERROR'), { fallbackToRest: !this.closed })); } }
}
