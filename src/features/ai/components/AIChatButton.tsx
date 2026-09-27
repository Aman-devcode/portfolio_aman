import { Sparkles } from 'lucide-react';
import type { RefObject } from 'react';
export function AIChatButton({ open, buttonRef, onClick }: { open: boolean; buttonRef: RefObject<HTMLButtonElement | null>; onClick: () => void }) {
  return <button ref={buttonRef} className="ai-chat-button" type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={open ? 'Aman AI chat open' : 'Ask Aman AI'} onClick={onClick}><Sparkles size={17} aria-hidden="true"/><span>Ask Aman AI</span></button>;
}
