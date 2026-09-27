import { lazy, Suspense, useEffect, useState } from 'react';
import { HeroFallback } from './HeroFallback';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { SceneLoading } from './SceneLoading';

const modelModules = import.meta.glob('../../assets/3d/developer.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const modelUrl = Object.values(modelModules)[0];
const LazyHeroScene = lazy(() => import('./HeroScene').then(module => ({ default: module.HeroScene })));
function webglAvailable() {
  try { const canvas = document.createElement('canvas'); return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')); }
  catch { return false; }
}
function useScenePreferences() {
  const [preferences, setPreferences] = useState({ reducedMotion: false, mobile: false, supported: false });
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 700px)');
    const update = () => {
      const constrained = (navigator.hardwareConcurrency || 8) <= 4 || ('deviceMemory' in navigator && Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) <= 4);
      setPreferences({ reducedMotion: motion.matches, mobile: mobile.matches, supported: webglAvailable() && !(mobile.matches && constrained) });
    };
    update(); motion.addEventListener('change', update); mobile.addEventListener('change', update);
    return () => { motion.removeEventListener('change', update); mobile.removeEventListener('change', update); };
  }, []);
  return preferences;
}
/** Loads the real scene only when the model asset exists and the device supports WebGL. */
export function HeroSceneLoader() {
  const { reducedMotion, mobile, supported } = useScenePreferences();
  if (!modelUrl || !supported) return <HeroFallback/>;
  return <SceneErrorBoundary><Suspense fallback={<div className="scene-shell"><HeroFallback/><div className="scene-loading-overlay"><SceneLoading/></div></div>}><LazyHeroScene modelUrl={modelUrl} reducedMotion={reducedMotion} mobile={mobile}/></Suspense></SceneErrorBoundary>;
}
