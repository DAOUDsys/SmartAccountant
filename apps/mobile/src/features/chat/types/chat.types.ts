export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'error' | 'pending';

export type ChatMessageStatus = 'sent' | 'pending' | 'streaming' | 'failed';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  status: ChatMessageStatus;
  errorMessage?: string;
}

export interface Conversation {
  id: string;
  title: string;
  subtitle: string;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  status: 'active' | 'draft' | 'review';
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  prompt: string;
}

export interface ChatSettingsState {
  conciseMode: boolean;
  confirmBeforeActions: boolean;
}
