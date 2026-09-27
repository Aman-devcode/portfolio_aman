export type ChatSocketMessage =
  | { type: 'chat.started'; requestId: string; conversationId: string }
  | { type: 'chat.delta'; requestId: string; delta: string }
  | { type: 'chat.completed'; requestId: string; message: string; sources: ChatSource[] }
  | { type: 'chat.error'; requestId?: string; code: string; message: string }
  | { type: 'chat.cancelled'; requestId: string };
export type ChatSource = { type: string; title: string; slug: string; source?: string };
