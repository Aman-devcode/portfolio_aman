import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const root = process.cwd();
const env = loadEnv('production', root, 'VITE_');
const siteUrl = env.VITE_SITE_URL?.trim();
const output = resolve(root, 'dist');
await mkdir(output, { recursive: true });

let origin;
if (siteUrl) {
  try {
    const parsed = new URL(siteUrl);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      parsed.search = '';
      parsed.hash = '';
      origin = parsed.href.replace(/\/+$/, '');
    }
  } catch {
    // Invalid or absent public URL means no canonical host can be published.
  }
}
if (origin) {
  const data = JSON.parse(await readFile(resolve(root, 'src/data/portfolioData.json'), 'utf8'));
  const routes = ['/', '/about', '/projects', ...data.projects.map(project => '/projects/' + encodeURIComponent(project.slug)), '/skills', '/ai-lab', '/contact'];
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + routes.map(route => '  <url><loc>' + origin + route + '</loc></url>').join('\n') + '\n</urlset>\n';
  await writeFile(resolve(output, 'sitemap.xml'), sitemap);
} else {
  // Remove an older generated sitemap when a production host is no longer configured.
  try { await (await import('node:fs/promises')).unlink(resolve(output, 'sitemap.xml')); } catch {}
}
const robots = 'User-agent: *\nAllow: /\n' + (origin ? 'Sitemap: ' + origin + '/sitemap.xml\n' : '');
await writeFile(resolve(output, 'robots.txt'), robots);
