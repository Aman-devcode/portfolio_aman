import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { SiteLayout } from '../components/layout/SiteLayout';
import { LoadingState } from '../components/ui/LoadingState';
import { AudioManager } from '../features/audio/AudioManager';
import { WelcomeExperience } from '../features/welcome/WelcomeExperience';
import { AIChatWidget } from '../features/ai/components/AIChatWidget';
import { RouteMetadata } from '../components/seo/RouteMetadata';
import { AmbientBackground } from '../components/layout/AmbientBackground';

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

const HomePage = lazy(() => import('../features/home/HomePage'));
const AboutPage = lazy(() => import('../features/about/AboutPage'));
const ProjectsPage = lazy(() => import('../features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('../features/projects/ProjectDetailPage'));
const SkillsPage = lazy(() => import('../features/skills/SkillsPage'));
const AILabPage = lazy(() => import('../features/ai-lab/AILabPage'));
const ContactPage = lazy(() => import('../features/contact/ContactPage'));
const NotFoundPage = lazy(() => import('../features/NotFoundPage'));

export default function App() {
  return <AudioManager><AmbientBackground /><WelcomeExperience><SiteLayout><RouteMetadata /><ScrollToTop /><Suspense fallback={<LoadingState />}><Routes>
    <Route path="/" element={<HomePage />} /><Route path="/about" element={<AboutPage />} />
    <Route path="/projects" element={<ProjectsPage />} /><Route path="/projects/:slug" element={<ProjectDetailPage />} />
    <Route path="/skills" element={<SkillsPage />} /><Route path="/ai-lab" element={<AILabPage />} />
    <Route path="/contact" element={<ContactPage />} /><Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense><AIChatWidget /></SiteLayout></WelcomeExperience></AudioManager>;
}

