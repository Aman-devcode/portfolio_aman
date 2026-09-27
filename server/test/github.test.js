import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { getGitHubConfig, validateRepositoryParameters } from '../src/github/githubConfig.js';
import { createGitHubCache } from '../src/github/githubCache.js';
import { createGitHubClient } from '../src/github/githubClient.js';
import { createGitHubService, normalizeRepository } from '../src/github/githubService.js';
import { requestId } from '../src/observability/requestMetrics.js';
import { errorHandler, notFound } from '../src/middleware/errorHandler.js';
import { createGitHubRouter } from '../src/github/githubRoutes.js';

const baseConfig = extras => getGitHubConfig({ GITHUB_USERNAME: 'aman-pandit', GITHUB_API_BASE_URL: 'https://api.github.test', GITHUB_CACHE_TTL_SECONDS: '60', ...extras });
function rawRepo(name, updatedAt, extras = {}) {
  return { id: name.length * 10, name, full_name: `aman-pandit/${name}`, description: `Description for ${name}`, html_url: `https://github.com/aman-pandit/${name}`, homepage: null, language: 'TypeScript', topics: ['portfolio', 1], stargazers_count: 3, forks_count: 1, open_issues_count: 2, updated_at: updatedAt, pushed_at: updatedAt, fork: false, archived: false, ...extras };
}

test('GitHub configuration defaults, optional token, and strict repository parameter validation', () => {
  const config = getGitHubConfig({ GITHUB_USERNAME: 'aman', GITHUB_API_BASE_URL: 'https://api.github.com' });
  assert.equal(config.token, ''); assert.equal(config.cacheTtlSeconds, 900); assert.equal(config.excludeForks, true); assert.equal(config.maxRepositories, 12);
  assert.deepEqual(validateRepositoryParameters('AMAN', 'WeatherGPT', config), { owner: 'aman', repo: 'WeatherGPT' });
  assert.throws(() => validateRepositoryParameters('elsewhere', 'demo', config), { code: 'GITHUB_BAD_REPOSITORY' });
  assert.throws(() => validateRepositoryParameters('aman', '..', config), { code: 'GITHUB_BAD_REPOSITORY' });
  assert.throws(() => getGitHubConfig({ GITHUB_USERNAME: 'bad/name' }), { code: 'GITHUB_CONFIG_INVALID' });
});

test('GitHub response normalization is frontend-safe and drops malformed or unsafe fields', () => {
  const normalized = normalizeRepository(rawRepo('weather-app', '2026-01-01T00:00:00Z', { homepage: 'javascript:alert(1)' }));
  assert.equal(normalized.fullName, 'aman-pandit/weather-app'); assert.equal(normalized.homepage, null); assert.deepEqual(normalized.topics, ['portfolio']);
  assert.equal(normalized.stars, 3); assert.equal('token' in normalized, false); assert.equal('featured' in normalized, false);
  assert.equal(normalizeRepository({ ...rawRepo('bad', '2026-01-01T00:00:00Z'), stargazers_count: undefined }), null);
});

test('repository service filters forks and archived repos, sorts by update date, and limits output', async () => {
  const config = getGitHubConfig({ GITHUB_USERNAME: 'aman', GITHUB_MAX_REPOSITORIES: '2' });
  const client = { async getRepositoriesPage() { return [rawRepo('older', '2025-01-01T00:00:00Z'), rawRepo('newest', '2026-01-01T00:00:00Z'), rawRepo('fork', '2026-05-01T00:00:00Z', { fork: true }), rawRepo('archived', '2026-04-01T00:00:00Z', { archived: true })]; } };
  const service = createGitHubService({ config, client, cache: createGitHubCache() });
  const repos = await service.getRepositories();
  assert.deepEqual(repos.map(repo => repo.name), ['newest', 'older']);
});

test('in-memory cache serves hits, shares concurrent misses, and expires entries', async () => {
  let now = 1000; let calls = 0;
  const cache = createGitHubCache({ ttlSeconds: 2, now: () => now });
  const fetcher = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { result: calls }; };
  const [first, concurrent] = await Promise.all([cache.getOrFetch('github:repos', fetcher), cache.getOrFetch('github:repos', fetcher)]);
  assert.deepEqual(first, concurrent); assert.equal(calls, 1);
  await cache.getOrFetch('github:repos', fetcher); assert.equal(calls, 1);
  now += 2001; await cache.getOrFetch('github:repos', fetcher); assert.equal(calls, 2);
  assert.ok(cache.inspect('github:repos').expiresAt > now);
});

test('GitHub client supports unauthenticated requests, token auth, rate limits, and safe upstream errors', async () => {
  let options;
  const okFetch = async (_url, init) => { options = init; return Response.json([rawRepo('public', '2026-01-01T00:00:00Z')]); };
  await createGitHubClient({ config: baseConfig(), fetchImpl: okFetch }).getRepositoriesPage('aman-pandit', 1);
  assert.equal('Authorization' in options.headers, false); assert.equal(options.headers.Accept, 'application/vnd.github+json');
  await createGitHubClient({ config: baseConfig({ GITHUB_TOKEN: 'server-secret' }), fetchImpl: okFetch }).getRepositoriesPage('aman-pandit', 1);
  assert.equal(options.headers.Authorization, 'Bearer server-secret');
  const limitedClient = createGitHubClient({ config: baseConfig(), fetchImpl: async () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 30) } }) });
  await assert.rejects(() => limitedClient.getRepositoriesPage('aman-pandit', 1), error => error.code === 'GITHUB_RATE_LIMITED' && error.retryAfterSeconds > 0);
  const failedClient = createGitHubClient({ config: baseConfig(), fetchImpl: async () => new Response('', { status: 500 }) });
  await assert.rejects(() => failedClient.getRepositoriesPage('aman-pandit', 1), { code: 'GITHUB_API_FAILED' });
});

test('README is fetched only on explicit call and normalized as UTF-8', async () => {
  let calls = 0;
  const client = createGitHubClient({ config: baseConfig(), fetchImpl: async () => { calls++; return Response.json({ encoding: 'base64', content: Buffer.from('# Aman\nPortfolio').toString('base64') }); } });
  const service = createGitHubService({ config: baseConfig(), client, cache: createGitHubCache() });
  const readme = await service.getReadme('aman-pandit', 'portfolio');
  assert.deepEqual(readme, { content: '# Aman\nPortfolio', encoding: 'utf-8' }); assert.equal(calls, 1);
  await service.getReadme('aman-pandit', 'portfolio'); assert.equal(calls, 1);
  await assert.rejects(() => service.getReadme('another-user', 'portfolio'), { code: 'GITHUB_BAD_REPOSITORY' });
});

async function withRouter(service, run) {
  const app = express(); app.use(requestId); app.use('/api/github', createGitHubRouter(service)); app.use(notFound); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, 'close'); }
}

test('GitHub routes return normalized success and safe unavailable, rate-limit, and malformed-parameter responses', async () => {
  const config = baseConfig(); const cache = createGitHubCache();
  const service = createGitHubService({ config, client: { async getRepositoriesPage() { return [rawRepo('verified-repo', '2026-02-01T00:00:00Z')]; }, async getReadme() { throw Object.assign(new Error('private upstream detail'), { code: 'GITHUB_RATE_LIMITED', retryAfterSeconds: 8 }); } }, cache });
  await withRouter(service, async base => {
    const success = await fetch(`${base}/api/github/repos`).then(response => response.json());
    assert.equal(success.success, true); assert.equal(success.repositories[0].name, 'verified-repo'); assert.equal('token' in success, false);
    const malformed = await fetch(`${base}/api/github/repos/other/../readme`);
    assert.ok([400, 404].includes(malformed.status));
    const limited = await fetch(`${base}/api/github/repos/aman-pandit/portfolio/readme`);
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '8'); const body = await limited.json();
    assert.equal(body.error.code, 'GITHUB_RATE_LIMITED'); assert.doesNotMatch(JSON.stringify(body), /private upstream detail|token/i);
  });
  const unavailable = createGitHubService({ config: getGitHubConfig({}), client: {}, cache: createGitHubCache() });
  await withRouter(unavailable, async base => {
    const response = await fetch(`${base}/api/github/repos`); assert.equal(response.status, 503);
    assert.equal((await response.json()).error.message, 'GitHub integration is not configured.');
  });
  const failed = createGitHubService({ config, client: { async getRepositoriesPage() { throw Object.assign(new Error('secret-bearing detail'), { code: 'GITHUB_API_FAILED' }); } }, cache: createGitHubCache() });
  await withRouter(failed, async base => {
    const response = await fetch(`${base}/api/github/repos`); assert.equal(response.status, 503);
    const body = await response.json(); assert.equal(body.error.message, 'GitHub data is temporarily unavailable.'); assert.doesNotMatch(JSON.stringify(body), /secret-bearing detail/);
  });
});
