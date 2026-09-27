import { ArrowUpRight, Code2, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { Project } from '../../data/projects';
import { ProjectVisual } from './ProjectVisual';
import { TechBadgeList } from './TechBadge';
function ExternalProjectLink({ href, children }: { href: string; children: ReactNode }) { return <a className="project-external-link" href={href} target="_blank" rel="noreferrer">{children}</a>; }
export function ProjectCard({ project }: { project: Project }) {
  return <Card className={`case-card ${project.featured ? 'is-featured' : ''}`}>
    <ProjectVisual title={project.title} image={project.image}/>
    <div className="case-card-content"><div className="case-card-meta"><span>{project.category ?? 'Category not provided'}</span>{project.featured && <span className="featured-label">FEATURED</span>}</div>
      <h3><Link to={`/projects/${project.slug}`}>{project.title}</Link></h3><p>{project.shortDescription}</p>
      {project.technologies.length ? <TechBadgeList technologies={project.technologies.map(item => item.name)}/> : <span className="project-not-provided">Technology details not provided</span>}
      <div className="case-card-footer"><Link className="case-study-link" to={`/projects/${project.slug}`}>View Case Study <ArrowUpRight size={15}/></Link><div className="project-card-links">{project.liveUrl ? <ExternalProjectLink href={project.liveUrl}><ExternalLink size={15}/><span>Live Demo</span></ExternalProjectLink> : <span className="project-link-pending">Demo not provided</span>}{project.githubUrl ? <ExternalProjectLink href={project.githubUrl}><Code2 size={15}/><span>GitHub</span></ExternalProjectLink> : <span className="project-link-pending">Source not provided</span>}</div></div>
    </div>
  </Card>;
}
