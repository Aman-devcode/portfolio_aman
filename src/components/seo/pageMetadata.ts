import type { Project } from '../../data/projects';

export type PageMetadata = { title: string; description: string; type: 'website' | 'article'; noindex?: boolean };

const pages: Record<string, PageMetadata> = {
  '/': { title: 'Aman Kumar Pandit | Full Stack Developer', description: 'Aman Kumar Pandit is a Full Stack Developer focused on MERN, backend engineering and AI-powered applications.', type: 'website' },
  '/about': { title: 'About | Aman Kumar Pandit', description: 'Learn about Aman Kumar Pandit’s work across frontend and backend development, dependable systems and practical AI features.', type: 'website' },
  '/projects': { title: 'Projects | Aman Kumar Pandit', description: 'Explore selected engineering case studies and project details from Aman Kumar Pandit’s portfolio.', type: 'website' },
  '/skills': { title: 'Skills & Technologies | Aman Kumar Pandit', description: 'Browse the frontend, backend, database, AI and tooling technologies listed in Aman Kumar Pandit’s portfolio.', type: 'website' },
  '/ai-lab': { title: 'AI Lab | Aman Kumar Pandit', description: 'Explore portfolio concepts and experiments involving LLMs, retrieval augmented generation and AI agents.', type: 'website' },
  '/contact': { title: 'Contact | Aman Kumar Pandit', description: 'Find the contact channels currently listed in Aman Kumar Pandit’s portfolio.', type: 'website' },
};

export function getPageMetadata(pathname: string, projects: Project[]): PageMetadata {
  const path = pathname.replace(/\/+$/, '') || '/';
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const slug = decodeURIComponent(projectMatch[1]);
    const project = projects.find(item => item.slug === slug);
    if (!project) return { title: 'Page not found | Aman Kumar Pandit', description: 'The requested portfolio page could not be found.', type: 'website', noindex: true };
    const detail = project.description && project.description !== 'Not provided'
      ? project.description
      : project.shortDescription && project.shortDescription !== 'Project description not provided.'
        ? project.shortDescription
        : 'Project details will be added when verified information is available.';
    return { title: project.title + ' | Aman Kumar Pandit', description: project.title + ': ' + detail, type: 'article' };
  }
  if (path === '/404') return { title: 'Page not found | Aman Kumar Pandit', description: 'The requested portfolio page could not be found.', type: 'website', noindex: true };
  return pages[path] ?? { title: 'Page not found | Aman Kumar Pandit', description: 'The requested portfolio page could not be found.', type: 'website', noindex: true };
}

export function getCanonicalUrl(siteUrl: string | undefined, pathname: string) {
  if (!siteUrl?.trim()) return undefined;
  try {
    const base = new URL(siteUrl.trim());
    if (!['http:', 'https:'].includes(base.protocol)) return undefined;
    base.search = '';
    base.hash = '';
    const prefix = base.pathname.replace(/\/+$/, '');
    base.pathname = prefix + (pathname.startsWith('/') ? pathname : '/' + pathname);
    return base.href;
  } catch {
    return undefined;
  }
}
