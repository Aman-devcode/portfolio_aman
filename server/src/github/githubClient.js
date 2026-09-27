import { getGitHubConfig, assertConfiguredUsername, validateRepositoryParameters } from './githubConfig.js';

export function createGitHubClient({ config = getGitHubConfig(), fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  async function request(path, { accept = 'application/vnd.github+json' } = {}) {
    let url;
    try { url = new URL(path, `${config.apiBaseUrl}/`); } catch { throw Object.assign(new Error('GitHub request could not be created.'), { code: 'GITHUB_CONFIG_INVALID' }); }
    let response;
    try {
      response = await fetchImpl(url, { headers: { Accept: accept, 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'AmanPortfolio', ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}) }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (cause) {
      throw Object.assign(new Error(cause?.name === 'TimeoutError' ? 'GitHub request timed out.' : 'GitHub request failed.'), { code: cause?.name === 'TimeoutError' ? 'GITHUB_TIMEOUT' : 'GITHUB_API_FAILED', cause });
    }
    if (response.status === 404) return { notFound: true };
    let errorBody;
    if (!response.ok && response.status !== 404) errorBody = await response.json().catch(() => null);
    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetAt = Number(response.headers.get('x-ratelimit-reset'));
    const secondaryLimit = response.status === 403 && /secondary rate limit|rate limit exceeded/i.test(typeof errorBody?.message === 'string' ? errorBody.message : '');
    if (response.status === 429 || (response.status === 403 && (remaining === '0' || response.headers.has('retry-after') || secondaryLimit))) {
      const retryHeader = Number(response.headers.get('retry-after'));
      const retryAfterSeconds = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : Number.isFinite(resetAt) && resetAt > 0 ? Math.max(1, resetAt - Math.floor(Date.now() / 1000)) : 60;
      throw Object.assign(new Error('GitHub API rate limit reached.'), { code: 'GITHUB_RATE_LIMITED', retryAfterSeconds });
    }
    if (!response.ok) throw Object.assign(new Error('GitHub API returned an error.'), { code: 'GITHUB_API_FAILED', status: response.status });
    try { return await response.json(); }
    catch (cause) { throw Object.assign(new Error('GitHub API returned invalid data.'), { code: 'GITHUB_API_FAILED', cause }); }
  }
  return Object.freeze({
    async getRepositoriesPage(username, page) {
      if (assertConfiguredUsername(config).toLowerCase() !== username.toLowerCase()) throw Object.assign(new Error('GitHub owner is not allowed.'), { code: 'GITHUB_BAD_REPOSITORY' });
      const query = new URLSearchParams({ type: 'owner', sort: 'updated', direction: 'desc', per_page: '100', page: String(page) });
      const result = await request(`/users/${encodeURIComponent(config.username)}/repos?${query}`);
      if (!Array.isArray(result)) throw Object.assign(new Error('GitHub repository response is invalid.'), { code: 'GITHUB_API_FAILED' });
      return result;
    },
    async getRepository(owner, repo) {
      const address = validateRepositoryParameters(owner, repo, config);
      const result = await request(`/repos/${encodeURIComponent(address.owner)}/${encodeURIComponent(address.repo)}`);
      return result.notFound ? null : result;
    },
    async getReadme(owner, repo) {
      const address = validateRepositoryParameters(owner, repo, config);
      const result = await request(`/repos/${encodeURIComponent(address.owner)}/${encodeURIComponent(address.repo)}/readme`);
      if (result.notFound) return null;
      if (result.encoding !== 'base64' || typeof result.content !== 'string') throw Object.assign(new Error('GitHub README response is invalid.'), { code: 'GITHUB_API_FAILED' });
      return { content: Buffer.from(result.content, 'base64').toString('utf8'), encoding: 'utf-8' };
    },
  });
}
