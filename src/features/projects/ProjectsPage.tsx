import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { ProjectGrid } from '../../components/projects/ProjectGrid';
import { projects } from '../../data/projects';
export default function ProjectsPage() {
  const featured = projects.filter(project => project.featured);
  return <div className="page-shell container project-index-page">
    <SectionHeading level={1} eyebrow="PORTFOLIO / PROJECTS" title="Selected projects" description="Engineering case studies with implementation details, architecture and decisions as they become available."/>
    {featured.length ? <ProjectGrid projects={featured} className="page-project-grid"/> : <p className="empty-project-state">Projects will be added here when details are available.</p>}
    <p className="project-index-note">Project descriptions, technologies, repository and demo links are filled in from verified project information.</p>
    <Link className="text-link" to="/contact">Discuss a project <span aria-hidden="true">↗</span></Link>
  </div>;
}

