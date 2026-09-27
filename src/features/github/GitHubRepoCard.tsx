import { ArrowUpRight, GitFork, Star } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { GitHubRepository } from './types';

function updatedDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date) : null;
}
export function GitHubRepoCard({ repository }: { repository: GitHubRepository }) {
  const updated = updatedDate(repository.updatedAt);
  return <Card className="github-repo-card">
    <div className="github-repo-heading"><span className="github-repo-mark" aria-hidden="true">{repository.name.slice(0, 1).toUpperCase()}</span><div><h3><a href={repository.htmlUrl} target="_blank" rel="noreferrer">{repository.name}<ArrowUpRight size={13} aria-hidden="true"/></a></h3><span className="github-repo-fullname">{repository.fullName}</span></div></div>
    <p className="github-repo-description">{repository.description || 'No description provided.'}</p>
    {repository.topics.length > 0 && <ul className="github-topic-list" aria-label="Repository topics">{repository.topics.slice(0, 5).map(topic => <li key={topic}>{topic}</li>)}</ul>}
    <div className="github-repo-meta"><span>{repository.language && <><i className="github-language-dot" aria-hidden="true"/>{repository.language}</>}</span><span className="github-repo-stat"><Star size={13} aria-hidden="true"/>{repository.stars.toLocaleString()}</span><span className="github-repo-stat"><GitFork size={13} aria-hidden="true"/>{repository.forks.toLocaleString()}</span></div>
    <div className="github-repo-footer">{updated && <time dateTime={repository.updatedAt}>Updated {updated}</time>}{repository.homepage && <a href={repository.homepage} target="_blank" rel="noreferrer">Live site <ArrowUpRight size={12} aria-hidden="true"/></a>}</div>
  </Card>;
}
