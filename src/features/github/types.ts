export type GitHubRepository = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  updatedAt: string;
  pushedAt: string | null;
  isFork: boolean;
  isArchived: boolean;
};
export type GitHubRepositoriesResponse = { success: true; repositories: GitHubRepository[] };
