import type { Project } from '../../data/projects';
import { ProjectCard } from './ProjectCard';
export function ProjectGrid({ projects, className = '' }: { projects: Project[]; className?: string }) {
  return <div className={`case-grid ${className}`}>{projects.map(project => <ProjectCard key={project.id} project={project}/>)}</div>;
}
