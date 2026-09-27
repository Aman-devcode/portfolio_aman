import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { attachWebSocketServer } from '../src/websocket/websocketServer.js';
import { parseClientMessage } from '../src/websocket/websocketMessages.js';

async function fixture(options = {}) {
  const server = createServer((_req, res) => { res.writeHead(404); res.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const wsServer = attachWebSocketServer(server, { config: { path: '/ws/chat', maxPayload: 4096, maxMessageCharacters: 2000, maxConnections: 20, idleTimeoutMs: 120000, heartbeatMs: 120000, maxConcurrentGenerations: 1 }, allowedOrigins: ['http://localhost:5173'], ...options });
  const address = `ws://127.0.0.1:${server.address().port}`;
  return { server, wsServer, address, async close() { await wsServer.closeServer(); await new Promise(resolve => server.close(resolve)); } };
}
function inbox(socket) {
  const queue = []; const waiters = [];
  socket.on('message', data => { const value = JSON.parse(data.toString()); const index = waiters.findIndex(waiter => waiter.predicate(value)); if (index >= 0) waiters.splice(index, 1)[0].resolve(value); else queue.push(value); });
  return predicate => {
    const index = queue.findIndex(predicate); if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
    return new Promise((resolve, reject) => { const waiter = { predicate, resolve }; waiters.push(waiter); setTimeout(() => { const i = waiters.indexOf(waiter); if (i >= 0) { waiters.splice(i, 1); reject(new Error('Timed out waiting for WebSocket message')); } }, 3000); });
  };
}
async function connect(address, origin = 'http://localhost:5173') {
  const socket = new WebSocket(`${address}/ws/chat`, { origin });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return socket;
}

test('WebSocket message validation rejects malformed, unsupported and oversized messages', () => {
  assert.equal(parseClientMessage('{').error, 'INVALID_MESSAGE');
  assert.equal(parseClientMessage(JSON.stringify({ type: 'chat.what', requestId: 'id' })).error, 'INVALID_MESSAGE');
  assert.equal(parseClientMessage(JSON.stringify({ type: 'chat.start', requestId: 'id', message: 'x'.repeat(2001) })).error, 'MESSAGE_TOO_LARGE');
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'chat.start', requestId: 'id', message: ' hello ' })).value, { type: 'chat.start', requestId: 'id', message: 'hello' });
});

test('WebSocket attaches to existing HTTP server and streams start, deltas and completion', async () => {
  const app = await fixture({ stream: async (_message, { onDelta }) => { onDelta('Hello '); onDelta('there'); return { message: 'Hello there', sources: [{ type: 'project', title: 'Demo', slug: 'demo' }] }; }, rateLimit: async () => ({ allowed: true }) });
  try {
    const socket = await connect(app.address); const next = inbox(socket); const requestId = 'req-1';
    socket.send(JSON.stringify({ type: 'chat.start', requestId, message: 'Hi' }));
    assert.equal((await next(value => value.type === 'chat.started')).requestId, requestId);
    assert.equal((await next(value => value.type === 'chat.delta')).delta, 'Hello ');
    assert.equal((await next(value => value.type === 'chat.delta')).delta, 'there');
    const completed = await next(value => value.type === 'chat.completed');
    assert.equal(completed.message, 'Hello there'); assert.equal(completed.sources[0].title, 'Demo');
    socket.close();
  } finally { await app.close(); }
});

test('WebSocket rejects bad path and unexpected origin', async () => {
  const app = await fixture();
  try {
    await assert.rejects(() => new Promise((resolve, reject) => { const socket = new WebSocket(`${app.address}/bad`); socket.once('open', resolve); socket.once('error', reject); }));
    await assert.rejects(() => new Promise((resolve, reject) => { const socket = new WebSocket(`${app.address}/ws/chat`, { origin: 'https://unexpected.test' }); socket.once('open', resolve); socket.once('error', reject); }));
  } finally { await app.close(); }
});

test('WebSocket connections are removed from the server client set after close', async () => {
  const app = await fixture();
  try {
    const socket = await connect(app.address);
    assert.equal(app.wsServer.clients.size, 1);
    await new Promise(resolve => { socket.once('close', resolve); socket.close(); });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(app.wsServer.clients.size, 0);
  } finally { await app.close(); }
});

test('WebSocket reports malformed messages and rejects concurrent requests', async () => {
  let release; const app = await fixture({
    stream: async () => new Promise(resolve => { release = () => resolve({ message: 'done', sources: [] }); }),
    rateLimit: async () => ({ allowed: true }),
  });
  try {
    const socket = await connect(app.address); const next = inbox(socket);
    socket.send('{'); assert.equal((await next(value => value.type === 'chat.error')).code, 'INVALID_MESSAGE');
    socket.send(JSON.stringify({ type: 'chat.start', requestId: 'first', message: 'hi' })); await next(value => value.type === 'chat.started');
    socket.send(JSON.stringify({ type: 'chat.start', requestId: 'second', message: 'hi' }));
    assert.equal((await next(value => value.type === 'chat.error' && value.requestId === 'second')).code, 'WEBSOCKET_ERROR');
    release(); await next(value => value.type === 'chat.completed');
    socket.close();
  } finally { release?.(); await app.close(); }
});

test('WebSocket rate limits requests with the shared limiter result', async () => {
  const app = await fixture({ rateLimit: async () => ({ allowed: false, retryAfter: 20 }) });
  try {
    const socket = await connect(app.address); const next = inbox(socket);
    socket.send(JSON.stringify({ type: 'chat.start', requestId: 'limited', message: 'hi' }));
    assert.equal((await next(value => value.type === 'chat.error')).code, 'RATE_LIMITED');
    socket.close();
  } finally { await app.close(); }
});

test('WebSocket cancellation aborts active generation and confirms cancellation', async () => {
  const app = await fixture({ stream: async (_message, { signal, onDelta }) => {
    onDelta('partial');
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  }, rateLimit: async () => ({ allowed: true }) });
  try {
    const socket = await connect(app.address); const next = inbox(socket); const requestId = 'cancel-1';
    socket.send(JSON.stringify({ type: 'chat.start', requestId, message: 'hi' }));
    await next(value => value.type === 'chat.delta');
    socket.send(JSON.stringify({ type: 'chat.cancel', requestId }));
    assert.equal((await next(value => value.type === 'chat.cancelled')).requestId, requestId);
    socket.close();
  } finally { await app.close(); }
});
