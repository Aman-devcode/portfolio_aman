import type { GitHubRepositoriesResponse } from './types';

function createGitHubError(message: string, code = 'GITHUB_UNAVAILABLE') {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

export async function fetchGitHubRepositories(signal?: AbortSignal): Promise<GitHubRepositoriesResponse> {
  let response: Response;
  try {
    response = await fetch('/api/github/repos', { headers: { Accept: 'application/json' }, signal: signal ?? AbortSignal.timeout(10000) });
  } catch {
    throw createGitHubError('GitHub data is temporarily unavailable.');
  }

  const result = await response.json().catch(() => null) as Partial<GitHubRepositoriesResponse> & { error?: { code?: string; message?: string } } | null;

  if (!response.ok) {
    const code = result?.error?.code ?? 'GITHUB_UNAVAILABLE';
    const message = result?.error?.message ?? 'GitHub data is temporarily unavailable.';
    throw createGitHubError(message, code);
  }

  if (result?.success !== true || !Array.isArray(result.repositories)) {
    throw createGitHubError('GitHub data is temporarily unavailable.');
  }

  return result as GitHubRepositoriesResponse;
}
