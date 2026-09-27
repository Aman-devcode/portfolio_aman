import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { audioConfig } from './audioConfig';

const welcomeAssets = import.meta.glob('../../assets/audio/welcome.wav', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const welcomeAudioUrl = Object.values(welcomeAssets)[0];
const PLAYED_KEY = audioConfig.welcomeSessionKey;
type PlaybackResult = 'played' | 'already-played' | 'unavailable' | 'muted' | 'blocked' | 'error';
type AudioApi = { available: boolean; muted: boolean; playing: boolean; hasPlayed: boolean; toggleMute: () => void; playWelcome: (fromGesture?: boolean) => Promise<PlaybackResult>; stopWelcome: () => void };
const AudioContext = createContext<AudioApi | null>(null);
function sessionHasPlayed() { try { return sessionStorage.getItem(PLAYED_KEY) === '1'; } catch { return false; } }

export function AudioManager({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const attemptRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(sessionHasPlayed);

  const stopWelcome = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setPlaying(false);
  }, []);
  const toggleMute = useCallback(() => {
    setMuted(current => {
      const next = !current;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);
  const playWelcome = useCallback(async (fromGesture = false): Promise<PlaybackResult> => {
    if (!welcomeAudioUrl) return 'unavailable';
    if (hasPlayed || sessionHasPlayed()) { setHasPlayed(true); return 'already-played'; }
    if (attemptRef.current) return 'muted';
    if (muted && !fromGesture) return 'muted';
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.src = welcomeAudioUrl;
      audio.volume = audioConfig.defaultVolume;
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); attemptRef.current = false; };
      audio.onerror = () => { setPlaying(false); attemptRef.current = false; };
    }
    if (fromGesture) { audio.muted = false; setMuted(false); }
    else audio.muted = muted;
    attemptRef.current = true;
    try { audio.currentTime = 0; } catch { /* The file may not be seekable until it loads. */ }
    try {
      await audio.play();
      setPlaying(true);
      setHasPlayed(true);
      try { sessionStorage.setItem(PLAYED_KEY, '1'); } catch { /* Session storage may be disabled. */ }
      return 'played';
    } catch (error) {
      setPlaying(false);
      attemptRef.current = false;
      return error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'error';
    }
  }, [hasPlayed, muted]);
  useEffect(() => () => { const audio = audioRef.current; if (audio) { audio.pause(); audio.src = ''; audioRef.current = null; } }, []);
  const value = useMemo(() => ({ available: Boolean(welcomeAudioUrl), muted, playing, hasPlayed, toggleMute, playWelcome, stopWelcome }), [muted, playing, hasPlayed, toggleMute, playWelcome, stopWelcome]);
  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}
export function useAudioManager() {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudioManager must be used within AudioManager.');
  return context;
}
