const boundedInteger = (value, fallback, min, max) => Number.isInteger(Number(value)) && Number(value) >= min ? Math.min(Number(value), max) : fallback;
export function getWebSocketConfig(env = process.env) {
  return Object.freeze({ path: '/ws/chat', maxPayload: 12 * 1024, maxMessageCharacters: 2000, maxConnections: boundedInteger(env.WS_MAX_CONNECTIONS, 200, 1, 2000), idleTimeoutMs: boundedInteger(env.WS_IDLE_TIMEOUT_MS, 120000, 30000, 600000), heartbeatMs: 30000, maxConcurrentGenerations: 1 });
}
