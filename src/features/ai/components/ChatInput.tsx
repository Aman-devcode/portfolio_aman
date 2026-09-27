import { ArrowUp, CornerDownLeft } from 'lucide-react';
import { useState, type KeyboardEvent, type RefObject, type FormEvent } from 'react';
export function ChatInput({ disabled, inputRef, onSend }: { disabled: boolean; inputRef: RefObject<HTMLTextAreaElement | null>; onSend: (message: string) => void }) {
  const [draft, setDraft] = useState('');
  const send = () => { const value = draft.trim(); if (!value || disabled) return; onSend(value); setDraft(''); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); send(); };
  return <form className="ai-chat-form" onSubmit={onSubmit}><label className="sr-only" htmlFor="aman-ai-input">Ask about Aman</label><textarea id="aman-ai-input" ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="Ask about Aman…" maxLength={2000} rows={2} disabled={disabled}/><div className="chat-input-footer"><span><CornerDownLeft size={12}/> Enter to send · Shift + Enter for a new line</span><button type="submit" className="chat-send-button" disabled={disabled || !draft.trim()} aria-label="Send message"><ArrowUp size={16}/></button></div></form>;
}

