import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dataUrl = new URL('../../../../src/data/portfolioData.json', import.meta.url);
function record(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Malformed portfolio source: ${label}`); }
function doc({ id, type, title, slug = type, content, category = type }) {
  if (![id, type, title, slug, content, category].every(value => typeof value === 'string' && value.trim())) throw new Error(`Malformed portfolio document: ${id}`);
  return { id, type, title, source: 'portfolio', content: content.trim(), metadata: { slug, category } };
}
export function loadCanonicalPortfolio() {
  try { return JSON.parse(readFileSync(fileURLToPath(dataUrl), 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw new Error('Could not load canonical portfolio data.', { cause: error }); }
}
export function buildPortfolioDocuments(data = loadCanonicalPortfolio()) {
  record(data, 'root'); record(data.about, 'about');
  for (const key of ['skills', 'projects', 'engineering']) if (!Array.isArray(data[key])) throw new Error(`Malformed portfolio data: ${key} must be an array.`);
  const docs = [];
  const about = data.about;
  const aboutText = [typeof about.name === 'string' && `Name: ${about.name}`, Array.isArray(about.roles) && about.roles.length && `Roles listed: ${about.roles.join(', ')}`, about.summary, about.intro].filter(value => typeof value === 'string' && value.trim()).join(' ');
  if (!aboutText) throw new Error('Malformed portfolio data: about is empty.');
  if (aboutText) docs.push(doc({ id: 'about:aman', type: 'about', title: about.name || 'About Aman', slug: 'about', content: aboutText }));
  for (const skill of data.skills) { record(skill, 'skills[]'); if (!Array.isArray(skill.items) || !skill.items.every(item => typeof item === 'string')) throw new Error('Malformed skill document.'); if (skill.items.length) docs.push(doc({ id: `skills:${skill.title.toLowerCase()}`, type: 'skills', title: `${skill.title} skills`, slug: skill.title.toLowerCase(), content: `${skill.title} technologies listed in Aman's portfolio: ${skill.items.join(', ')}.` })); }
  for (const project of data.projects) {
    record(project, 'projects[]'); if (typeof project.title !== 'string' || typeof project.slug !== 'string') throw new Error('Malformed project document.');
    const verified = [project.description, project.problem, project.solution].filter(value => typeof value === 'string' && value.trim() && !/not provided|details pending/i.test(value));
    const tech = Array.isArray(project.technologies) ? project.technologies.map(item => typeof item === 'string' ? item : item?.name).filter(value => typeof value === 'string' && value.trim()) : [];
    const features = Array.isArray(project.features) ? project.features.filter(value => typeof value === 'string' && value.trim()) : [];
    const details = [...verified, ...(tech.length ? [`Technologies listed: ${tech.join(', ')}.`] : []), ...(features.length ? [`Features listed: ${features.join('; ')}.`] : [])];
    const content = details.length ? `Portfolio project: ${project.title}. ${details.join(' ')}` : `Portfolio project listing: ${project.title}. No verified project description, features, technologies, architecture, links, or metrics are provided in the canonical portfolio data.`;
    docs.push(doc({ id: `project:${project.slug}`, type: 'project', title: project.title, slug: project.slug, category: typeof project.category === 'string' && !/pending/i.test(project.category) ? project.category : 'project', content }));
  }
  for (const topic of data.engineering) { record(topic, 'engineering[]'); if (typeof topic.title !== 'string' || typeof topic.description !== 'string') throw new Error('Malformed engineering document.'); const tech = Array.isArray(topic.technologies) ? topic.technologies.filter(value => typeof value === 'string') : []; docs.push(doc({ id: `engineering:${topic.slug}`, type: 'engineering', title: topic.title, slug: topic.slug, content: `${topic.title}: ${topic.description}${tech.length ? ` Technologies: ${tech.join(', ')}.` : ''}` })); }
  if (Array.isArray(data.experience)) for (const item of data.experience) { record(item, 'experience[]'); const title = item.title || item.role || item.company || 'Experience'; const content = Object.entries(item).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => `${key}: ${value}`).join('. '); if (content) docs.push(doc({ id: `experience:${item.id || item.slug || docs.length}`, type: 'experience', title, slug: item.slug || String(item.id || 'experience'), content })); }
  if (data.contact && typeof data.contact === 'object') { const links = Object.entries(data.contact).filter(([key, value]) => key !== 'route' && typeof value === 'string' && value.trim()); const content = links.length ? links.map(([key, value]) => `${key}: ${value}`).join('. ') : 'A contact page is available at /contact. No direct email or social profile is listed in the canonical portfolio data.'; docs.push(doc({ id: 'contact:portfolio', type: 'contact', title: 'Contact Aman', slug: 'contact', content: `Contact information: ${content}` })); }
  const ids = new Set(); for (const item of docs) { if (ids.has(item.id)) throw new Error(`Duplicate document id: ${item.id}`); ids.add(item.id); }
  return docs;
}
