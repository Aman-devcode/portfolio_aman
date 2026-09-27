import { useEffect, useRef } from 'react';
import { ArrowRight, Volume2 } from 'lucide-react';
type Props = { canEnableSound: boolean; soundMessage: string; exiting: boolean; onEnter: () => void; onEnableSound: () => void };
export function WelcomeOverlay({ canEnableSound, soundMessage, exiting, onEnter, onEnableSound }: Props) {
  const panel = useRef<HTMLElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { enterButton.current?.focus(); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onEnter(); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      const controls = Array.from(panel.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (controls.length === 0) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onEnter]);
  return <div className={`welcome-overlay ${exiting ? 'is-exiting' : ''}`}>
    <section className="welcome-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description">
      <span className="welcome-kicker"><i/> AMAN KUMAR PANDIT <span> / PORTFOLIO</span></span>
      <h1 id="welcome-title">Welcome to Aman’s<br/><span>portfolio.</span></h1>
      <p id="welcome-description">Full Stack Developer <b aria-hidden="true">·</b> AI Engineer</p>
      <div className="welcome-actions"><button ref={enterButton} className="button button-primary" onClick={onEnter}>Enter Portfolio <ArrowRight size={16} aria-hidden="true"/></button>{canEnableSound && <button className="button button-ghost welcome-sound" onClick={onEnableSound}><Volume2 size={16} aria-hidden="true"/> Enable Sound</button>}</div>
      <p className="welcome-note" aria-live="polite">{soundMessage}</p>
      <span className="welcome-index">ENGINEERING / 001</span>
    </section>
  </div>;
}
