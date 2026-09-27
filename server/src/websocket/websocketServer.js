import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { streamAnswer } from '../services/ai/geminiService.js';
import { consumeChatRateLimit } from '../services/rateLimiter.js';
import { getWebSocketConfig } from './websocketConfig.js';
import { parseClientMessage, serverMessage } from './websocketMessages.js';
import { safeChatError } from './websocketErrors.js';
import { sendSocketMessage } from './websocketClient.js';
import { logger } from '../observability/logger.js';
import { withLogContext } from '../observability/context.js';
import { incrementMetric, setGauge, observeDuration } from '../observability/metrics.js';
import { getWebSocketClientIdentity, trustProxy } from '../security/clientIdentity.js';

export function attachWebSocketServer(httpServer, { stream = streamAnswer, rateLimit = consumeChatRateLimit, config = getWebSocketConfig(), allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean) } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.maxPayload, perMessageDeflate: false });
  const clients = new Set();
  const upgrade = (request, socket, head) => {
    let url; try { url = new URL(request.url, 'http://localhost'); } catch { socket.destroy(); return; }
    if (url.pathname !== config.path) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    if (clients.size >= config.maxConnections) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  };
  httpServer.on('upgrade', upgrade);
  wss.on('connection', (socket, request) => {
    const connectionId = randomUUID(); const connectedAt = performance.now();
    clients.add(socket); socket.isAlive = true; let active = null; let idleTimer;
    incrementMetric('websocket.connections'); setGauge('websocket.connections.active', clients.size);
    withLogContext({ connectionId }, () => logger.info('websocket.connected'));
    const touch = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => socket.close(1001, 'Idle timeout'), config.idleTimeoutMs); idleTimer.unref?.(); };
    touch();
    socket.on('pong', () => { socket.isAlive = true; touch(); });
    socket.on('message', raw => {
      touch();
      if (raw.length > config.maxPayload) { sendSocketMessage(socket, serverMessage('chat.error', { code: 'MESSAGE_TOO_LARGE', message: 'Message is too large.' })); return; }
      const parsed = parseClientMessage(raw, config.maxMessageCharacters);
      if (parsed.error) { incrementMetric('websocket.errors'); withLogContext({ connectionId, ...(parsed.requestId ? { requestId: parsed.requestId } : {}) }, () => logger.warn('websocket.error', { errorCode: parsed.error })); sendSocketMessage(socket, serverMessage('chat.error', { ...(parsed.requestId ? { requestId: parsed.requestId } : {}), ...safeChatError({ code: parsed.error }) })); return; }
      const message = parsed.value;
      if (message.type === 'chat.cancel') {
        if (active?.requestId === message.requestId) { active.cancelled = true; active.controller.abort(); incrementMetric('websocket.cancellations'); withLogContext({ connectionId, requestId: message.requestId }, () => logger.info('websocket.stream.cancelled')); sendSocketMessage(socket, serverMessage('chat.cancelled', { requestId: message.requestId })); }
        return;
      }
      incrementMetric('websocket.messages'); withLogContext({ connectionId, requestId: message.requestId }, () => logger.info('websocket.message.received'));
      if (active) { incrementMetric('websocket.errors'); withLogContext({ connectionId, requestId: message.requestId }, () => logger.warn('websocket.error', { errorCode: 'CONCURRENT_REQUEST' })); sendSocketMessage(socket, serverMessage('chat.error', { requestId: message.requestId, code: 'WEBSOCKET_ERROR', message: 'A response is already in progress.' })); return; }
      void withLogContext({ connectionId, requestId: message.requestId }, () => processMessage(message));
    });
    async function processMessage(message) {
      const started = performance.now(); const controller = new AbortController(); const current = { requestId: message.requestId, controller, cancelled: false }; active = current;
      sendSocketMessage(socket, serverMessage('chat.started', { requestId: message.requestId, conversationId: randomUUID() }));
      try {
        const limit = await rateLimit(getWebSocketClientIdentity(request, trustProxy));
        if (current.cancelled) return;
        if (!limit.allowed) { incrementMetric('websocket.errors'); logger.warn('websocket.error', { errorCode: 'RATE_LIMITED' }); sendSocketMessage(socket, serverMessage('chat.error', { requestId: message.requestId, code: 'RATE_LIMITED', message: 'Too many requests.' })); return; }
        logger.info('websocket.stream.started');
        const result = await stream(message.message, { signal: controller.signal, onDelta: delta => { if (!current.cancelled) sendSocketMessage(socket, serverMessage('chat.delta', { requestId: message.requestId, delta })); } });
        if (!current.cancelled) { incrementMetric('websocket.streams.completed'); logger.info('websocket.stream.completed', { durationMs: Math.round(performance.now() - started), sourceCount: result.sources?.length || 0 }); sendSocketMessage(socket, serverMessage('chat.completed', { requestId: message.requestId, message: result.message, sources: result.sources || [] })); }
      } catch (error) {
        if (!current.cancelled && socket.readyState === WebSocket.OPEN) { incrementMetric('websocket.errors'); logger.warn('websocket.error', { errorCode: safeChatError(error).code }); sendSocketMessage(socket, serverMessage('chat.error', { requestId: message.requestId, ...safeChatError(error) })); }
      } finally { observeDuration('websocket.stream', performance.now() - started); if (active === current) active = null; }
    }
    socket.on('error', () => {});
    socket.on('close', () => { clearTimeout(idleTimer); clients.delete(socket); setGauge('websocket.connections.active', clients.size); active?.controller.abort(); observeDuration('websocket.connection', performance.now() - connectedAt); withLogContext({ connectionId }, () => logger.info('websocket.closed', { durationMs: Math.round(performance.now() - connectedAt) })); });
  });
  const heartbeat = setInterval(() => {
    for (const socket of clients) { if (!socket.isAlive) { socket.terminate(); clients.delete(socket); continue; } socket.isAlive = false; socket.ping(); }
  }, config.heartbeatMs);
  heartbeat.unref?.();
  wss.closeServer = () => { clearInterval(heartbeat); httpServer.off('upgrade', upgrade); for (const socket of clients) socket.close(1001, 'Server shutting down'); return new Promise(resolve => wss.close(() => resolve())); };
  return wss;
}

