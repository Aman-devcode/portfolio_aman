type GitHubErrorStateProps = { kind?: 'error' | 'disabled' };

export function GitHubErrorState({ kind = 'error' }: GitHubErrorStateProps) {
  if (kind === 'disabled') {
    return (
      <div className="github-state-message github-state-disabled" role="status" aria-live="polite">
        <strong>GitHub integration is currently disabled.</strong>
        <span>Public repository data will appear here once a GitHub account is configured.</span>
      </div>
    );
  }

  return <p className="github-state-message" role="status">GitHub data is temporarily unavailable.</p>;
}
