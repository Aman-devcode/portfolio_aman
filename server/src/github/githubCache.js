export function createGitHubCache({ ttlSeconds = 900, now = () => Date.now() } = {}) {
  const entries = new Map();
  const inFlight = new Map();
  return Object.freeze({
    async getOrFetch(key, fetcher) {
      const time = now();
      const cached = entries.get(key);
      if (cached && cached.expiresAt > time) return cached.data;
      if (inFlight.has(key)) return inFlight.get(key);
      const request = Promise.resolve().then(fetcher).then(data => {
        const fetchedAt = now();
        entries.set(key, { data, fetchedAt, expiresAt: fetchedAt + ttlSeconds * 1000 });
        return data;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, request);
      return request;
    },
    clear() { entries.clear(); inFlight.clear(); },
    inspect(key) { const entry = entries.get(key); return entry ? { fetchedAt: entry.fetchedAt, expiresAt: entry.expiresAt } : undefined; },
  });
}
