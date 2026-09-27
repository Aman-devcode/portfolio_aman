export function GitHubLoadingState() {
  return <div className="github-repo-grid" role="status" aria-label="Loading GitHub repositories"><p className="sr-only">Loading GitHub repositories...</p>{[0, 1, 2].map(item => <div className="github-repo-skeleton" key={item} aria-hidden="true"><i/><i/><i/><i/></div>)}</div>;
}
