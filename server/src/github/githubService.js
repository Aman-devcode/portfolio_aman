import { getGitHubConfig, assertConfiguredUsername, validateRepositoryParameters } from './githubConfig.js';
import { createGitHubClient } from './githubClient.js';
import { createGitHubCache } from './githubCache.js';
import { getCache, setCache } from '../redis/redisClient.js';
import { redisKeys } from '../redis/redisKeys.js';
import { logger } from '../observability/logger.js';
import { incrementMetric } from '../observability/metrics.js';

export function createTieredCache(ttlSeconds, { get = getCache, set = setCache } = {}) {
  const memory = createGitHubCache({ ttlSeconds });
  return { async getOrFetch(key, fetcher) {
    let cacheState = 'memory';
    const value = await memory.getOrFetch(key, async () => {
    const redisKey = key.startsWith('github:readme:') ? redisKeys.githubReadme(...key.slice('github:readme:'.length).split(':')) : redisKeys.githubRepos(...key.slice('github:repos:'.length).split(':', 2));
    const cached = await get(redisKey);
    if (cached !== null) { cacheState = 'redis'; return cached; }
    cacheState = 'miss';
    const value = await fetcher(); await set(redisKey, value, ttlSeconds); return value;
    });
    const hit = cacheState !== 'miss'; incrementMetric(hit ? 'github.cache.hits' : 'github.cache.misses');
    logger.debug(hit ? 'github.cache.hit' : 'github.cache.miss', { endpointCategory: key.startsWith('github:readme:') ? 'readme' : 'repos', cacheLayer: cacheState });
    return value;
  } };
}

function safeUrl(value, host, allowHttp = false) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); const allowed = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:'); return allowed && !url.username && !url.password && (!host || url.hostname === host) ? url.toString() : null; }
  catch { return null; }
}
export function normalizeRepository(repository) {
  if (!repository || typeof repository !== 'object' || !Number.isSafeInteger(repository.id) || repository.id < 0 || typeof repository.name !== 'string' || typeof repository.full_name !== 'string' || typeof repository.html_url !== 'string' || !Number.isFinite(repository.stargazers_count) || repository.stargazers_count < 0 || !Number.isFinite(repository.forks_count) || repository.forks_count < 0 || !Number.isFinite(repository.open_issues_count) || repository.open_issues_count < 0 || typeof repository.updated_at !== 'string' || !Number.isFinite(Date.parse(repository.updated_at)) || typeof repository.fork !== 'boolean' || typeof repository.archived !== 'boolean') return null;
  const htmlUrl = safeUrl(repository.html_url, 'github.com');
  if (!htmlUrl) return null;
  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    description: typeof repository.description === 'string' ? repository.description : null,
    htmlUrl,
    homepage: safeUrl(repository.homepage, undefined, true),
    language: typeof repository.language === 'string' ? repository.language : null,
    topics: Array.isArray(repository.topics) ? repository.topics.filter(topic => typeof topic === 'string').slice(0, 20) : [],
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    openIssues: repository.open_issues_count,
    updatedAt: repository.updated_at,
    pushedAt: typeof repository.pushed_at === 'string' && Number.isFinite(Date.parse(repository.pushed_at)) ? repository.pushed_at : null,
    isFork: repository.fork,
    isArchived: repository.archived,
  };
}

export function createGitHubService({ config = getGitHubConfig(), client = createGitHubClient({ config }), cache } = {}) {
  cache ??= createTieredCache(config.cacheTtlSeconds);
  async function getRepositories() {
    const started = performance.now();
    const username = assertConfiguredUsername(config);
    const key = `github:repos:${username.toLowerCase()}:forks-${!config.excludeForks}-archived-${!config.excludeArchived}`;
    try { const value = await cache.getOrFetch(key, async () => {
      const candidates = [];
      for (let page = 1; page <= config.maxRepositoryPages && candidates.length < config.maxRepositories; page++) {
        const result = await client.getRepositoriesPage(username, page);
        for (const item of result) {
          if (config.excludeForks && item.fork === true) continue;
          if (config.excludeArchived && item.archived === true) continue;
          const normalized = normalizeRepository(item);
          if (normalized) candidates.push(normalized);
        }
        if (result.length < 100) break;
      }
      candidates.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || (Date.parse(b.pushedAt || '') || 0) - (Date.parse(a.pushedAt || '') || 0) || a.name.localeCompare(b.name));
      return candidates.slice(0, config.maxRepositories);
    }); logger.info('github.request.completed', { endpointCategory: 'repos', durationMs: Math.round(performance.now() - started) }); return value; }
    catch (error) { logger.warn('github.request.failed', { endpointCategory: 'repos', durationMs: Math.round(performance.now() - started), errorCategory: error.code || 'GITHUB_API_FAILED' }); throw error; }
  }
  async function getReadme(owner, repo) {
    const started = performance.now();
    const username = assertConfiguredUsername(config);
    const address = validateRepositoryParameters(owner, repo, config);
    const key = `github:readme:${username.toLowerCase()}:${address.repo.toLowerCase()}`;
    try { const value = await cache.getOrFetch(key, () => client.getReadme(address.owner, address.repo)); logger.info('github.request.completed', { endpointCategory: 'readme', durationMs: Math.round(performance.now() - started) }); return value; }
    catch (error) { logger.warn('github.request.failed', { endpointCategory: 'readme', durationMs: Math.round(performance.now() - started), errorCategory: error.code || 'GITHUB_API_FAILED' }); throw error; }
  }
  return Object.freeze({ getRepositories, getReadme, getRepositoryDetails: (...args) => client.getRepository(...args) });
}
