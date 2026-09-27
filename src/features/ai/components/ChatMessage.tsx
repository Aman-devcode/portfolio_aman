import { memo, type ReactNode } from 'react';
import { Bot, UserRound } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../types/chat';

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderContent(content: string): ReactNode {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    const ordered = listItems[0].ordered;
    const ListTag = ordered ? 'ol' : 'ul';
    blocks.push(
      <ListTag className="chat-markdown-list" key={`list-${blocks.length}`}>
        {listItems.map((item, index) => <li key={index}>{renderInline(item.text)}</li>)}
      </ListTag>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      if (listItems.length && listItems[0].ordered !== isOrdered) flushList();
      listItems.push({ ordered: isOrdered, text: (unordered?.[1] ?? ordered?.[1] ?? '').trim() });
      return;
    }
    flushList();
    if (!trimmed) {
      blocks.push(<div className="chat-markdown-spacer" key={`space-${index}`} />);
      return;
    }
    blocks.push(<p key={`p-${index}`}>{renderInline(trimmed)}</p>);
  });
  flushList();
  return blocks;
}

export const ChatMessage = memo(function ChatMessage({ message }: { message: ChatMessageType }) {
  const assistant = message.role === 'assistant';
  const classes = 'chat-message ' + (assistant ? 'assistant-message' : 'user-message') + (message.isError ? ' message-error' : '');
  return <article className={classes}>
    <span className="chat-message-avatar" aria-hidden="true">{assistant ? <Bot size={14}/> : <UserRound size={14}/>}</span>
    <div className="chat-message-content">
      <span className="chat-message-author">{assistant ? 'AMAN AI' : 'YOU'}</span>
      <div className="chat-message-body">{renderContent(message.content)}</div>
      {message.sources?.length ? <ul className="chat-sources">{message.sources.map(source => <li key={source.type + '-' + source.slug}><span>{source.title}</span></li>)}</ul> : null}
    </div>
  </article>;
});
