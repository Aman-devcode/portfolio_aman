const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export function getGitHubConfig(env = process.env) {
  const apiBaseUrl = env.GITHUB_API_BASE_URL || 'https://api.github.com';
  let parsed;
  try { parsed = new URL(apiBaseUrl); } catch { throw Object.assign(new Error('GitHub API base URL is invalid.'), { code: 'GITHUB_CONFIG_INVALID' }); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Object.assign(new Error('GitHub API base URL must be an HTTPS URL without credentials.'), { code: 'GITHUB_CONFIG_INVALID' });
  const username = (env.GITHUB_USERNAME || '').trim();
  if (username && !USERNAME_PATTERN.test(username)) throw Object.assign(new Error('GitHub username is invalid.'), { code: 'GITHUB_CONFIG_INVALID' });
  const ttl = Number(env.GITHUB_CACHE_TTL_SECONDS);
  const maxRepositories = Number(env.GITHUB_MAX_REPOSITORIES);
  return Object.freeze({
    username,
    token: env.GITHUB_TOKEN || '',
    apiBaseUrl: parsed.toString().replace(/\/$/, ''),
    cacheTtlSeconds: Number.isFinite(ttl) && ttl >= 0 ? Math.min(ttl, 86400) : 900,
    maxRepositories: Number.isInteger(maxRepositories) && maxRepositories > 0 ? Math.min(maxRepositories, 100) : 12,
    maxRepositoryPages: 5,
    excludeForks: env.GITHUB_INCLUDE_FORKS !== 'true',
    excludeArchived: env.GITHUB_INCLUDE_ARCHIVED !== 'true',
  });
}
export function assertConfiguredUsername(config) {
  if (!config.username) throw Object.assign(new Error('GitHub integration is not configured.'), { code: 'GITHUB_NOT_CONFIGURED' });
  return config.username;
}
export function validateRepositoryParameters(owner, repo, config) {
  const validName = value => typeof value === 'string' && value.length <= 100 && /^[A-Za-z0-9_.-]+$/.test(value) && value !== '.' && value !== '..';
  if (!validName(owner) || !validName(repo)) throw Object.assign(new Error('Repository address is invalid.'), { code: 'GITHUB_BAD_REPOSITORY' });
  assertConfiguredUsername(config);
  if (owner.toLowerCase() !== config.username.toLowerCase()) throw Object.assign(new Error('Repository owner is not allowed.'), { code: 'GITHUB_BAD_REPOSITORY' });
  return { owner: config.username, repo };
}
