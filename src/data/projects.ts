export type TechnologyCategory = 'Frontend' | 'Backend' | 'Database' | 'AI' | 'Infrastructure' | 'Other';
export type Technology = { name: string; category: TechnologyCategory };
export type ProjectImage = { src: string; alt: string };
export type ArchitectureNode = { id: string; label: string; detail?: string };
export type ArchitectureConnection = { from: string; to: string; label?: string };
export type ProjectArchitecture = { nodes: ArchitectureNode[]; connections: ArchitectureConnection[] };
export interface Project {
  id: string; slug: string; title: string; shortDescription: string; description?: string; category?: string; featured: boolean;
  technologies: Technology[]; features?: string[]; problem?: string; solution?: string; architecture?: ProjectArchitecture;
  engineeringDecisions?: string[]; challenges?: string[]; learnings?: string[]; futureImprovements?: string[];
  githubUrl?: string; liveUrl?: string; image?: ProjectImage; screenshots?: ProjectImage[]; architectureImage?: ProjectImage;
}
import portfolioData from './portfolioData.json';
export const projects: Project[] = portfolioData.projects as Project[];
