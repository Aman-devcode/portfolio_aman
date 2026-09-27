export type ChatRole = 'user' | 'assistant';
import type { ChatSource } from '../services/chatProtocol';
export type ChatMessage = { id: string; role: ChatRole; content: string; isError?: boolean; sources?: ChatSource[] };
export const welcomeMessage: ChatMessage = { id: 'welcome', role: 'assistant', content: "Hi! I'm Aman's portfolio assistant. Ask me anything about his work, projects, or technical skills." };
export const suggestedQuestions = [
  'What projects has Aman built?',
  'What backend technologies does he use?',
  'Tell me about WeatherGPT',
  'What AI technologies is he exploring?'
];
