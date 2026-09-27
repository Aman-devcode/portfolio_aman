import { useEffect, useRef, useState } from 'react';
import { AIChatButton } from './AIChatButton';
import { AIChatPanel } from './AIChatPanel';
import { sendMessage } from '../services/aiApi';
import { welcomeMessage, type ChatMessage } from '../types/chat';
import { ChatSocket, type SocketState } from '../services/chatSocket';

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [loading, setLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<SocketState>('connecting');
  const loadingRef = useRef(false);
  const socketRef = useRef<ChatSocket | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pendingDeltasRef = useRef<Record<string, string>>({});
  const deltaTimerRef = useRef<number | undefined>(undefined);

  const flushStreamDeltas = () => {
    if (deltaTimerRef.current !== undefined) window.clearTimeout(deltaTimerRef.current);
    deltaTimerRef.current = undefined;
    const pending = pendingDeltasRef.current;
    pendingDeltasRef.current = {};
    if (!Object.keys(pending).length) return;
    setMessages(current => current.map(item => pending[item.id] ? { ...item, content: item.content + pending[item.id] } : item));
  };
  const queueStreamDelta = (id: string, delta: string) => {
    pendingDeltasRef.current[id] = (pendingDeltasRef.current[id] ?? '') + delta;
    if (deltaTimerRef.current === undefined) deltaTimerRef.current = window.setTimeout(flushStreamDeltas, 32);
  };

  useEffect(() => {
    if (!open) return;
    const socket = new ChatSocket(setConnectionState); socketRef.current = socket; void socket.connect();
    const onOnline = () => void socket.connect(); const onOffline = () => setConnectionState('fallback');
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); socket.close(); abortRef.current?.abort(); if (socketRef.current === socket) socketRef.current = null; };
  }, [open]);

  useEffect(() => () => {
    if (deltaTimerRef.current !== undefined) window.clearTimeout(deltaTimerRef.current);
  }, []);

  const close = () => {
    stoppedRef.current = true;
    flushStreamDeltas();
    socketRef.current?.close();
    abortRef.current?.abort();
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const send = async (text: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    stoppedRef.current = false;
    setLoading(true);
    const assistantId = crypto.randomUUID();
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '' }]);
    try {
      let answer = await socketRef.current?.sendMessage(text, delta => queueStreamDelta(assistantId, delta));
      flushStreamDeltas();
      if (answer === null || answer === undefined) {
        abortRef.current = new AbortController();
        answer = await sendMessage(text, abortRef.current.signal);
      }
      if (!stoppedRef.current) setMessages(current => current.map(item => item.id === assistantId ? { ...item, content: answer!.message, sources: answer!.sources } : item));
    } catch (error) {
      flushStreamDeltas();
      if (stoppedRef.current) return;
      if (error && typeof error === 'object' && 'fallbackToRest' in error && error.fallbackToRest === true && !stoppedRef.current) {
        try {
          abortRef.current = new AbortController();
          const fallback = await sendMessage(text, abortRef.current.signal);
          if (!stoppedRef.current) setMessages(current => current.map(item => item.id === assistantId ? { ...item, content: fallback.message, sources: fallback.sources } : item));
          return;
        } catch (fallbackError) { error = fallbackError; }
      }
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setMessages(current => current.map(item => item.id === assistantId ? { ...item, content: item.content || message, isError: !item.content } : item));
    } finally { flushStreamDeltas(); abortRef.current = null; loadingRef.current = false; setLoading(false); }
  };

  const stop = () => {
    stoppedRef.current = true;
    flushStreamDeltas();
    socketRef.current?.cancel();
    abortRef.current?.abort();
    loadingRef.current = false;
    setLoading(false);
  };
  return <div className="ai-chat-widget" data-open={open ? 'true' : 'false'}><AIChatButton open={open} buttonRef={buttonRef} onClick={() => setOpen(true)}/>{open && <AIChatPanel messages={messages} loading={loading} connectionState={connectionState} onClose={close} onSend={send} onStop={stop}/>}</div>;
}
