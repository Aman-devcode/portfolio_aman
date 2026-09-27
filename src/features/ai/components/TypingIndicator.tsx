import { useEffect, useRef } from 'react';
export function TypingIndicator() { const ref = useRef<HTMLDivElement>(null); useEffect(() => { ref.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, []); return <div ref={ref} className="typing-indicator" role="status" aria-label="Aman AI is typing"><span>AMAN AI IS THINKING</span><i/><i/><i/></div>; }
