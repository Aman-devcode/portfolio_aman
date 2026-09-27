import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Code2, ExternalLink } from 'lucide-react';
import { projects, type Project } from '../../data/projects';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { TechBadgeList } from '../../components/projects/TechBadge';
import { ProjectVisual } from '../../components/projects/ProjectVisual';
import { ArchitectureDiagram } from '../../components/projects/ArchitectureDiagram';

const sections: { key: keyof Project; title: string }[] = [
  { key: 'problem', title: 'Problem' }, { key: 'solution', title: 'Solution' }, { key: 'features', title: 'Key Features' },
  { key: 'engineeringDecisions', title: 'Engineering Decisions' }, { key: 'challenges', title: 'Challenges' },
  { key: 'learnings', title: 'Learnings' }, { key: 'futureImprovements', title: 'Future Improvements' }
];
function contentValue(value: Project[keyof Project]) {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && value.length) return value;
  return undefined;
}
function DetailSection({ title, value }: { title: string; value: unknown }) {
  const content = contentValue(value as Project[keyof Project]);
  return <section className="case-detail-section"><span className="eyebrow">CASE STUDY / {title.toUpperCase()}</span><h2>{title}</h2>{Array.isArray(content) ? <ul>{content.map((item, index) => <li key={`${title}-${index}`}>{String(item)}</li>)}</ul> : <p>{content ? String(content) : 'Not provided'}</p>}</section>;
}
function ProjectActions({ project }: { project: Project }) {
  return <div className="case-detail-actions">{project.liveUrl && <a className="button button-primary" href={project.liveUrl} target="_blank" rel="noreferrer">Live Demo <ExternalLink size={15}/></a>}{project.githubUrl && <a className="button button-secondary" href={project.githubUrl} target="_blank" rel="noreferrer"><Code2 size={15}/> Source Code</a>}{!project.liveUrl && !project.githubUrl && <span className="project-not-provided">Demo and source links not provided</span>}</div>;
}
function ProjectNotFound() { return <div className="page-shell container project-not-found"><span className="eyebrow">PROJECT / NOT FOUND</span><h1>This case study isnâ€™t available.</h1><p>Check the project address or return to the project index.</p><Link className="button button-secondary" to="/projects"><ArrowLeft size={15}/> Back to Projects</Link></div>; }
export default function ProjectDetailPage() {
  const { slug } = useParams();
  const project = projects.find(item => item.slug === slug);
  if (!project) return <ProjectNotFound/>;
  const technologyGroups = ['Frontend', 'Backend', 'Database', 'AI', 'Infrastructure', 'Other'].map(category => ({ category, items: project.technologies.filter(item => item.category === category) })).filter(group => group.items.length);
  return <article className="page-shell container project-detail-page">
    <Link className="back-link" to="/projects"><ArrowLeft size={15}/> All Projects</Link>
    <header className="project-detail-hero"><div className="project-detail-copy"><span className="eyebrow">CASE STUDY / {project.category ?? 'DETAILS PENDING'}</span><h1>{project.title}</h1><p className="project-detail-lead">{project.shortDescription}</p>{project.technologies.length ? <TechBadgeList technologies={project.technologies.map(item => item.name)}/> : <span className="project-not-provided">Technology details not provided</span>}<ProjectActions project={project}/></div><ProjectVisual title={project.title} image={project.image} className="project-detail-image"/></header>
    <div className="project-detail-body"><div className="project-detail-main">{sections.map(section => <DetailSection key={section.key} title={section.title} value={project[section.key]}/>)}
      <DetailSection title="Overview" value={project.description}/>
      <section className="case-detail-section"><span className="eyebrow">CASE STUDY / TECHNOLOGY</span><h2>Technology</h2>{technologyGroups.length ? technologyGroups.map(group => <div className="technology-group" key={group.category}><h3>{group.category}</h3><TechBadgeList technologies={group.items.map(item => item.name)}/></div>) : <p>Not provided</p>}</section>
      {project.screenshots?.length ? <section className="case-detail-section"><span className="eyebrow">CASE STUDY / SCREENSHOTS</span><h2>Project Screenshots</h2><div className="project-screenshots">{project.screenshots.map(image => <figure key={image.src}><img src={image.src} alt={image.alt} loading="lazy" decoding="async"/><figcaption>{image.alt}</figcaption></figure>)}</div></section> : <section className="case-detail-section"><span className="eyebrow">CASE STUDY / SCREENSHOTS</span><h2>Project Images</h2><p>Not provided</p></section>}
    </div><aside className="project-detail-aside"><ArchitectureDiagram architecture={project.architecture} image={project.architectureImage}/><div className="project-aside-links"><h2>Project Links</h2><ProjectActions project={project}/></div></aside></div>
    <footer className="case-study-footer"><SectionHeading eyebrow="MORE WORK" title="Explore other projects"/><Link className="text-link" to="/projects">View all projects <ArrowUpRight size={15}/></Link></footer>
  </article>;
}


