import { Router } from 'express';
import { getGitHubConfig } from './githubConfig.js';
import { createGitHubService } from './githubService.js';
import { AppError } from '../errors/AppError.js';

function normalizeError(error) {
  if (error.code === 'GITHUB_NOT_CONFIGURED') return new AppError({ statusCode: 503, code: error.code, safeMessage: 'GitHub integration is not configured.', cause: error });
  if (error.code === 'GITHUB_BAD_REPOSITORY') return new AppError({ statusCode: 400, code: error.code, safeMessage: 'Repository address is invalid.', cause: error });
  if (error.code === 'GITHUB_RATE_LIMITED') return new AppError({ statusCode: 429, code: error.code, safeMessage: 'GitHub data is temporarily unavailable.', retryAfter: error.retryAfterSeconds, cause: error });
  return new AppError({ statusCode: 503, code: 'GITHUB_UNAVAILABLE', safeMessage: 'GitHub data is temporarily unavailable.', cause: error });
}

export function createGitHubRouter(service) {
  const router = Router();
  let activeService = service;
  const getService = () => activeService ??= createGitHubService({ config: getGitHubConfig() });
  router.get('/repos', async (_req, res, next) => {
    try { res.json({ success: true, repositories: await getService().getRepositories() }); }
    catch (error) { next(normalizeError(error)); }
  });
  router.get('/repos/:owner/:repo/readme', async (req, res, next) => {
    try {
      const readme = await getService().getReadme(req.params.owner, req.params.repo);
      res.json({ success: true, repository: `${req.params.owner}/${req.params.repo}`, content: readme?.content ?? null, encoding: 'utf-8' });
    } catch (error) { next(normalizeError(error)); }
  });
  return router;
}
export default createGitHubRouter();
