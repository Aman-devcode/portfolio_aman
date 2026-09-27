import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../src/app.js';

test('REST chat validates payload shape and size with safe structured errors before provider calls', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const empty = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '  ' }) });
    const emptyBody = await empty.json();
    assert.equal(empty.status, 400); assert.equal(emptyBody.error.code, 'INVALID_MESSAGE'); assert.ok(emptyBody.error.requestId);
    const tooLong = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(2001) }) });
    const tooLongBody = await tooLong.json();
    assert.equal(tooLong.status, 413); assert.equal(tooLongBody.error.code, 'MESSAGE_TOO_LARGE'); assert.doesNotMatch(JSON.stringify(tooLongBody), /x{100}/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
