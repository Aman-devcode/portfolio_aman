import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });
const { default: app } = await import('./app.js');
const { closeRedis, getRedisClient } = await import('./redis/redisClient.js');
const { attachWebSocketServer } = await import('./websocket/websocketServer.js');
const { logger } = await import('./observability/logger.js');
getRedisClient();
const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, () => logger.info('server.listening', { port }));
const webSocketServer = attachWebSocketServer(server);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await webSocketServer.closeServer();
  const closed = new Promise(resolve => server.close(resolve));
  const timeout = setTimeout(() => server.closeAllConnections?.(), 10000);
  timeout.unref();
  await Promise.allSettled([closed, closeRedis()]);
  clearTimeout(timeout);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
