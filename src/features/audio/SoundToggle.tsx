import { Volume2, VolumeX } from 'lucide-react';
import { useAudioManager } from './AudioManager';
export function SoundToggle() {
  const { available, muted, toggleMute } = useAudioManager();
  const label = available ? (muted ? 'Turn sound on' : 'Turn sound off') : 'Sound unavailable until the welcome audio is added';
  return <button className="sound-toggle" type="button" onClick={toggleMute} disabled={!available} aria-label={label} title={label}>{muted || !available ? <VolumeX size={16} aria-hidden="true"/> : <Volume2 size={16} aria-hidden="true"/>}</button>;
}
