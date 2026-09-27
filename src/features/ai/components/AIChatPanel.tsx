import { useEffect, useId, useRef } from 'react';
import { Minus, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { ChatMessage as ChatMessageType } from '../types/chat';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { SuggestedQuestions } from './SuggestedQuestions';
import { TypingIndicator } from './TypingIndicator';
import { suggestedQuestions } from '../types/chat';

export function AIChatPanel({ messages, loading, connectionState, onClose, onSend, onStop }: { messages: ChatMessageType[]; loading: boolean; connectionState: string; onClose: () => void; onSend: (message: string) => void; onStop: () => void }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [messages, loading]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)') ?? []);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
  };
  return <div className="ai-chat-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="ai-chat-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
      <header className="ai-chat-header"><div className="ai-chat-identity"><span className="ai-chat-mark">AI</span><div><h2 id={titleId}>Aman AI</h2><p>Portfolio Assistant <span className="ai-online-dot"/>{connectionState === 'fallback' ? ' Â· standard connection' : ''}</p></div></div><div className="ai-chat-header-actions"><button type="button" aria-label="Minimize chat" onClick={onClose}><Minus size={17}/></button><button type="button" aria-label="Close chat" onClick={onClose}><X size={17}/></button></div></header>
      <div className="ai-chat-log" ref={logRef} aria-live="polite" aria-relevant="additions text" aria-label="Conversation">
        {messages.map(message => <ChatMessage key={message.id} message={message}/>)}
        {messages.length === 1 && <SuggestedQuestions questions={suggestedQuestions} onSelect={onSend} disabled={loading}/>}
        {loading && <TypingIndicator/>}
      </div>
      <ChatInput disabled={loading} inputRef={inputRef} onSend={onSend}/>
      {loading && <button type="button" className="chat-stop-button" onClick={onStop}>Stop generating</button>}
      <p className="ai-chat-disclaimer">Answers use information available in this portfolio.</p>
    </section>
  </div>;
}

