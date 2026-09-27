import { getLogContext } from './context.js';
const levels = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = levels[configured] ?? levels.info;
const unsafeField = /(secret|token|password|credential|prompt|question|query|content|answer|body|message|text|redisurl|api.?key|embedding)/i;

function safeFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !unsafeField.test(key)).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 256) : value]));
}
function write(level, event, fields = {}) {
  if (levels[level] < threshold) return;
  const record = { timestamp: new Date().toISOString(), level, event: String(event).slice(0, 120), ...safeFields(getLogContext()), ...safeFields(fields) };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
}
export const logger = Object.freeze({ debug: (event, fields) => write('debug', event, fields), info: (event, fields) => write('info', event, fields), warn: (event, fields) => write('warn', event, fields), error: (event, fields) => write('error', event, fields) });
