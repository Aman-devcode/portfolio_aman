import { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { GitHubErrorState } from './GitHubErrorState';
import { fetchGitHubRepositories } from './githubApi';
import { GitHubLoadingState } from './GitHubLoadingState';
import { GitHubRepoGrid } from './GitHubRepoGrid';
import type { GitHubRepository } from './types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; repositories: GitHubRepository[] }
  | { status: 'disabled' }
  | { status: 'error' };

export function GitHubSection() {
  const [state, setState] = useState<State>({ status: import.meta.env.VITE_GITHUB_ENABLED === 'false' ? 'disabled' : 'loading' });

  useEffect(() => {
    if (import.meta.env.VITE_GITHUB_ENABLED === 'false') {
      setState({ status: 'disabled' });
      return;
    }

    const controller = new AbortController();
    fetchGitHubRepositories(controller.signal)
      .then(result => setState({ status: 'ready', repositories: result.repositories }))
      .catch((error: Error & { code?: string }) => {
        if (controller.signal.aborted) return;
        if (error?.code === 'GITHUB_NOT_CONFIGURED') {
          setState({ status: 'disabled' });
          return;
        }
        setState({ status: 'error' });
      });

    return () => controller.abort();
  }, []);

  return <section className="section-wrap section-alt" id="github" aria-label="GitHub repositories"><div className="container">
    <div className="section-top"><div className="github-section-title"><Code2 size={18} aria-hidden="true"/><SectionHeading eyebrow="OPEN SOURCE / GITHUB" title="On GitHub" description="Public repository data from the configured GitHub account."/></div></div>
    {state.status === 'loading' && <GitHubLoadingState/>}
    {state.status === 'disabled' && <GitHubErrorState kind="disabled"/>}
    {state.status === 'error' && <GitHubErrorState kind="error"/>}
    {state.status === 'ready' && (state.repositories.length ? <GitHubRepoGrid repositories={state.repositories}/> : <p className="github-state-message" role="status">No public repositories found.</p>)}
  </div></section>;
}
