import { describe, expect, it } from 'vitest';
import type { Project } from '../../data/projects';
import { getCanonicalUrl, getPageMetadata } from './pageMetadata';

const projects: Project[] = [
  { id: 'sample', slug: 'sample', title: 'Sample Project', shortDescription: 'A verified project summary.', featured: true, technologies: [] },
  { id: 'pending', slug: 'pending', title: 'Pending Project', shortDescription: 'Project description not provided.', featured: true, technologies: [] },
];

describe('route metadata', () => {
  it('provides distinct metadata for each static page', () => {
    const routes = ['/', '/about', '/projects', '/skills', '/ai-lab', '/contact'];
    const titles = routes.map(route => getPageMetadata(route, projects).title);
    expect(new Set(titles).size).toBe(routes.length);
    expect(routes.map(route => getPageMetadata(route, projects).description).every(Boolean)).toBe(true);
  });

  it('uses canonical project data without inventing project details', () => {
    expect(getPageMetadata('/projects/sample', projects).description).toBe('Sample Project: A verified project summary.');
    expect(getPageMetadata('/projects/pending', projects).description).toContain('Project details will be added when verified information is available.');
    expect(getPageMetadata('/projects/missing', projects).noindex).toBe(true);
  });

  it('only produces canonical URLs when a valid site URL is configured', () => {
    expect(getCanonicalUrl(undefined, '/about')).toBeUndefined();
    expect(getCanonicalUrl('javascript:alert(1)', '/about')).toBeUndefined();
    expect(getCanonicalUrl('https://portfolio.test/', '/about')).toBe('https://portfolio.test/about');
  });
});
