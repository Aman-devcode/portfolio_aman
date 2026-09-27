import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { WelcomeOverlay } from './WelcomeOverlay';
import { useAudioManager } from '../audio/AudioManager';
import { audioConfig } from '../audio/audioConfig';
function sessionHas(key: string) { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } }
function sessionSet(key: string) { try { sessionStorage.setItem(key, '1'); } catch { /* The experience still works when storage is disabled. */ } }
export function WelcomeExperience({ children }: { children: ReactNode }) {
  const { available, hasPlayed, playing, playWelcome, stopWelcome } = useAudioManager();
  const [visible, setVisible] = useState(() => !sessionHas(audioConfig.enteredSessionKey) && !sessionHas(audioConfig.welcomeSessionKey));
  const autoAttempted = useRef(false);
  const [exiting, setExiting] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [soundMessage, setSoundMessage] = useState(available ? 'Welcome sound is ready. If your browser blocks autoplay, use Enable Sound.' : 'Welcome sound is ready. Use Enable Sound if autoplay is blocked.');

  const restorePageState = useCallback(() => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (!visible) {
      restorePageState();
      return;
    }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';
    };
  }, [visible, restorePageState]);

  const enter = useCallback(() => {
    if (!visible || exiting) return;
    stopWelcome();
    sessionSet(audioConfig.enteredSessionKey);
    setExiting(true);
    restorePageState();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      setExiting(false);
      setVisible(false);
      restorePageState();
    }, reduced ? 0 : 260);
  }, [visible, exiting, stopWelcome, restorePageState]);

  useEffect(() => {
    if (!visible || hasPlayed || !available || autoAttempted.current) return;
    autoAttempted.current = true;
    void playWelcome(false).then(result => {
      if (result === 'played') setAutoPlaying(true);
      else if (result === 'blocked') setSoundMessage('Autoplay is blocked by the browser. Use Enable Sound to play it.');
      else if (result === 'error') setSoundMessage('Welcome sound could not be played. You can enter the portfolio silently.');
    });
  }, [visible, hasPlayed, available, playWelcome]);

  useEffect(() => { if (autoPlaying && !playing) enter(); }, [autoPlaying, playing, enter]);

  const enableSound = useCallback(() => {
    setSoundMessage('');
    void playWelcome(true).then(result => {
      if (result === 'played') setAutoPlaying(true);
      else if (result === 'error') setSoundMessage('Welcome sound could not be played. Enter the portfolio silently.');
      else if (result === 'unavailable') setSoundMessage('Welcome sound is ready. Use Enable Sound if autoplay is blocked.');
    });
  }, [playWelcome]);

  return <>{children}{visible && <WelcomeOverlay canEnableSound={available} soundMessage={soundMessage} exiting={exiting} onEnter={enter} onEnableSound={enableSound}/>}</>;
}
