import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { projects } from '../../data/projects';
import { getCanonicalUrl, getPageMetadata } from './pageMetadata';

function setMeta(attribute: 'name' | 'property', key: string, content: string | undefined) {
  const selector = 'meta[' + attribute + '="' + key + '"]';
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) { element?.remove(); return; }
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function setLink(rel: string, href: string | undefined) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) { element?.remove(); return; }
  if (!element) { element = document.createElement('link'); element.rel = rel; document.head.append(element); }
  element.href = href;
}

function setCanonical(href: string | undefined) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) { element?.remove(); return; }
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }
  element.href = href;
}

export function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const metadata = getPageMetadata(pathname, projects);
    const canonical = getCanonicalUrl(import.meta.env.VITE_SITE_URL, pathname);
    document.title = metadata.title;
    document.documentElement.lang = 'en';
    setMeta('name', 'description', metadata.description);
    setMeta('name', 'robots', metadata.noindex ? 'noindex, follow' : undefined);
    setMeta('property', 'og:title', metadata.title);
    setMeta('property', 'og:description', metadata.description);
    setMeta('property', 'og:type', metadata.type);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:site_name', 'Aman Kumar Pandit Portfolio');
    const imageUrl = canonical ? new URL('/og-image.jpg', canonical).href : undefined;
    setMeta('property', 'og:image', imageUrl);
    setMeta('property', 'og:image:alt', 'Aman Kumar Pandit — Full Stack Developer portfolio');
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', metadata.title);
    setMeta('name', 'twitter:description', metadata.description);
    setMeta('name', 'twitter:image', imageUrl);
    setMeta('name', 'twitter:image:alt', 'Aman Kumar Pandit — Full Stack Developer portfolio');
    setLink('alternate', undefined);
    setCanonical(canonical);
  }, [pathname]);
  return null;
}
