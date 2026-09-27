import type { GitHubRepository } from './types';
import { GitHubRepoCard } from './GitHubRepoCard';
export function GitHubRepoGrid({ repositories }: { repositories: GitHubRepository[] }) {
  return <div className="github-repo-grid">{repositories.map(repository => <GitHubRepoCard key={repository.id} repository={repository}/>)}</div>;
}
