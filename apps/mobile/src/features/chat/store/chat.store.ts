import { create } from 'zustand';
import { mockConversations, mockMessagesByConversation } from '../data/mock-chat-data';
import type { ChatMessage, ChatSettingsState, Conversation } from '../types/chat.types';
import {
  createConversationTitle,
  createMockAssistantResponse,
  createPreview,
  getLastMessage,
} from '../utils/message-formatters';

interface ChatState {
  activeConversationId?: string;
  conversations: Conversation[];
  composerDrafts: Record<string, string>;
  messagesByConversation: Record<string, ChatMessage[]>;
  settings: ChatSettingsState;
  typingByConversation: Record<string, boolean>;
  clearConversation: (conversationId: string) => void;
  createConversation: () => string;
  receiveMockAssistantMessage: (conversationId: string, userMessage: string) => void;
  retryMessage: (conversationId: string, messageId: string) => void;
  sendMessage: (conversationId: string, content: string) => void;
  setActiveConversation: (conversationId?: string) => void;
  setComposerDraft: (conversationId: string, draft: string) => void;
  toggleConciseMode: () => void;
  toggleConfirmBeforeActions: () => void;
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort(
    (first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
  );
}

function updateConversationPreview(
  conversations: Conversation[],
  conversationId: string,
  preview: string,
  timestamp: string,
  title?: string,
) {
  return sortConversations(
    conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            lastMessagePreview: preview,
            title: title ?? conversation.title,
            updatedAt: timestamp,
            unreadCount: 0,
          }
        : conversation,
    ),
  );
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: mockConversations[0]?.id,
  conversations: sortConversations(mockConversations),
  composerDrafts: {},
  messagesByConversation: mockMessagesByConversation,
  settings: {
    conciseMode: false,
    confirmBeforeActions: true,
  },
  typingByConversation: {},

  clearConversation: (conversationId) => {
    const timestamp = new Date().toISOString();
    const systemMessage: ChatMessage = {
      id: createId('msg_system'),
      conversationId,
      content: 'Conversation cleared locally. No backend records were changed.',
      createdAt: timestamp,
      role: 'system',
      status: 'sent',
    };

    set((state) => ({
      composerDrafts: {
        ...state.composerDrafts,
        [conversationId]: '',
      },
      conversations: updateConversationPreview(
        state.conversations,
        conversationId,
        systemMessage.content,
        timestamp,
      ),
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [systemMessage],
      },
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: false,
      },
    }));
  },

  createConversation: () => {
    const timestamp = new Date().toISOString();
    const conversationId = createId('conversation');
    const conversation: Conversation = {
      id: conversationId,
      title: 'New accounting chat',
      subtitle: 'Ready for a sale, expense, statement, or stock question',
      lastMessagePreview: 'Start with a natural accounting message.',
      createdAt: timestamp,
      updatedAt: timestamp,
      unreadCount: 0,
      status: 'draft',
    };

    set((state) => ({
      activeConversationId: conversationId,
      composerDrafts: {
        ...state.composerDrafts,
        [conversationId]: '',
      },
      conversations: sortConversations([conversation, ...state.conversations]),
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [],
      },
    }));

    return conversationId;
  },

  receiveMockAssistantMessage: (conversationId, userMessage) => {
    const timestamp = new Date().toISOString();
    const response = createMockAssistantResponse(userMessage);
    const streamingMessageId = createId('msg_assistant_streaming');

    const streamingMessage: ChatMessage = {
      id: streamingMessageId,
      conversationId,
      content: 'Reviewing the accounting details...',
      createdAt: timestamp,
      role: 'assistant',
      status: 'streaming',
    };

    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [
          ...(state.messagesByConversation[conversationId] ?? []),
          streamingMessage,
        ],
      },
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: false,
      },
    }));

    setTimeout(() => {
      const completedAt = new Date().toISOString();

      set((state) => {
        const messages = state.messagesByConversation[conversationId] ?? [];
        const updatedMessages = messages.map((message) =>
          message.id === streamingMessageId
            ? {
                ...message,
                content: response,
                createdAt: completedAt,
                status: 'sent' as const,
              }
            : message,
        );

        return {
          conversations: updateConversationPreview(
            state.conversations,
            conversationId,
            createPreview(response),
            completedAt,
          ),
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: updatedMessages,
          },
        };
      });
    }, 1_100);
  },

  retryMessage: (conversationId, messageId) => {
    const state = get();
    const messages = state.messagesByConversation[conversationId] ?? [];
    const failedMessage = messages.find((message) => message.id === messageId);
    const previousUserMessage = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'user' && message.createdAt <= (failedMessage?.createdAt ?? ''),
      );

    set((current) => ({
      messagesByConversation: {
        ...current.messagesByConversation,
        [conversationId]: messages.filter((message) => message.id !== messageId),
      },
      typingByConversation: {
        ...current.typingByConversation,
        [conversationId]: true,
      },
    }));

    setTimeout(() => {
      get().receiveMockAssistantMessage(conversationId, previousUserMessage?.content ?? 'Retry');
    }, 700);
  },

  sendMessage: (conversationId, content) => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    const timestamp = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: createId('msg_user'),
      conversationId,
      content: trimmedContent,
      createdAt: timestamp,
      role: 'user',
      status: 'sent',
    };

    set((state) => {
      const messages = state.messagesByConversation[conversationId] ?? [];
      const firstUserMessage = messages.filter((message) => message.role === 'user').length === 0;
      const title = firstUserMessage ? createConversationTitle(trimmedContent) : undefined;

      return {
        composerDrafts: {
          ...state.composerDrafts,
          [conversationId]: '',
        },
        conversations: updateConversationPreview(
          state.conversations,
          conversationId,
          createPreview(trimmedContent),
          timestamp,
          title,
        ),
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...messages, userMessage],
        },
        typingByConversation: {
          ...state.typingByConversation,
          [conversationId]: true,
        },
      };
    });

    setTimeout(() => {
      if (trimmedContent.toLowerCase().includes('simulate error')) {
        const failedAt = new Date().toISOString();
        const errorMessage: ChatMessage = {
          id: createId('msg_error'),
          conversationId,
          content: 'The local mock response failed before completion.',
          createdAt: failedAt,
          errorMessage: 'Mock-only failure. Retry will run the local assistant response again.',
          role: 'error',
          status: 'failed',
        };

        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: [
              ...(state.messagesByConversation[conversationId] ?? []),
              errorMessage,
            ],
          },
          typingByConversation: {
            ...state.typingByConversation,
            [conversationId]: false,
          },
        }));
        return;
      }

      get().receiveMockAssistantMessage(conversationId, trimmedContent);
    }, 850);
  },

  setActiveConversation: (conversationId) => {
    set((state) => ({
      activeConversationId: conversationId,
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
      ),
    }));
  },

  setComposerDraft: (conversationId, draft) => {
    set((state) => ({
      composerDrafts: {
        ...state.composerDrafts,
        [conversationId]: draft,
      },
    }));
  },

  toggleConciseMode: () => {
    set((state) => ({
      settings: {
        ...state.settings,
        conciseMode: !state.settings.conciseMode,
      },
    }));
  },

  toggleConfirmBeforeActions: () => {
    set((state) => ({
      settings: {
        ...state.settings,
        confirmBeforeActions: !state.settings.confirmBeforeActions,
      },
    }));
  },
}));

export function selectLastMessage(conversationId: string): ChatMessage | undefined {
  return getLastMessage(useChatStore.getState().messagesByConversation[conversationId] ?? []);
}
