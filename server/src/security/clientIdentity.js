import { createHash } from 'node:crypto';

export function parseTrustProxy(value = process.env.TRUST_PROXY) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  if (/^(0|[1-9]\d*)$/.test(value)) return Number(value);
  throw new Error('TRUST_PROXY must be false, true, or a non-negative integer.');
}

export const trustProxy = parseTrustProxy();

function forwardedChain(value) {
  if (typeof value !== 'string') return [];
  return value.split(',').map(address => address.trim()).filter(Boolean);
}

export function resolveSocketAddress(remoteAddress, forwardedFor, proxyTrust = trustProxy) {
  if (!proxyTrust) return remoteAddress || 'unknown';
  const forwarded = forwardedChain(forwardedFor);
  if (!forwarded.length) return remoteAddress || 'unknown';
  if (proxyTrust === true) return forwarded[0];
  // Select the address at the configured trusted hop count, walking from the socket inward.
  return forwarded[Math.max(0, forwarded.length - proxyTrust)] || remoteAddress || 'unknown';
}

export function hashClientIdentity(identity) {
  return createHash('sha256').update(String(identity || 'unknown')).digest('hex');
}

export function getHttpClientIdentity(req) {
  // Express computes req.ip using app.get('trust proxy'), including its proxy-addr rules.
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function getWebSocketClientIdentity(request, proxyTrust = trustProxy) {
  return resolveSocketAddress(request.socket?.remoteAddress, request.headers?.['x-forwarded-for'], proxyTrust);
}
