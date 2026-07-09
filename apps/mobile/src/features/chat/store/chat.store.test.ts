import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockConversations, suggestedPrompts } from '../data/mock-chat-data';
import { selectLastMessage, useChatStore } from './chat.store';

const assistantPersistenceWords = /\b(saved|recorded|created)\b/i;

function resetChatStore() {
  useChatStore.setState(useChatStore.getInitialState(), true);
}

function getMessages(conversationId: string) {
  return useChatStore.getState().messagesByConversation[conversationId] ?? [];
}

function getActiveConversationId() {
  const activeConversationId = useChatStore.getState().activeConversationId;

  if (!activeConversationId) {
    throw new Error('Expected an active conversation id.');
  }

  return activeConversationId;
}

function advanceMockAssistantResponse() {
  vi.advanceTimersByTime(850);
  vi.advanceTimersByTime(1_100);
}

describe('chat store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T09:00:00.000Z'));
    resetChatStore();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    resetChatStore();
  });

  it('starts with mock conversations and an active conversation', () => {
    const state = useChatStore.getState();

    expect(state.conversations).toHaveLength(mockConversations.length);
    expect(state.conversations.map((conversation) => conversation.id)).toContain(
      'conversation_daily_sales',
    );
    expect(state.activeConversationId).toBe('conversation_daily_sales');
    expect(getMessages('conversation_daily_sales')).toHaveLength(3);
  });

  it('creates a draft conversation and makes it active', () => {
    const conversationId = useChatStore.getState().createConversation();
    const state = useChatStore.getState();

    expect(state.activeConversationId).toBe(conversationId);
    expect(state.conversations[0]).toMatchObject({
      id: conversationId,
      status: 'draft',
      title: 'New accounting chat',
    });
    expect(state.messagesByConversation[conversationId]).toEqual([]);
    expect(state.composerDrafts[conversationId]).toBe('');
  });

  it('updates the active conversation id and clears unread count', () => {
    useChatStore.getState().setActiveConversation('conversation_daily_sales');

    const state = useChatStore.getState();
    const activeConversation = state.conversations.find(
      (conversation) => conversation.id === 'conversation_daily_sales',
    );

    expect(state.activeConversationId).toBe('conversation_daily_sales');
    expect(activeConversation?.unreadCount).toBe(0);
  });

  it('adds a user message, clears the draft, and toggles typing state while sending', () => {
    const conversationId = getActiveConversationId();

    useChatStore.getState().setComposerDraft(conversationId, 'draft text');
    useChatStore.getState().sendMessage(conversationId, 'Paid $50 for electricity');

    const messages = getMessages(conversationId);

    expect(messages.at(-1)).toMatchObject({
      content: 'Paid $50 for electricity',
      role: 'user',
      status: 'sent',
    });
    expect(useChatStore.getState().composerDrafts[conversationId]).toBe('');
    expect(useChatStore.getState().typingByConversation[conversationId]).toBe(true);

    vi.advanceTimersByTime(850);

    expect(selectLastMessage(conversationId)).toMatchObject({
      role: 'assistant',
      status: 'streaming',
    });
    expect(useChatStore.getState().typingByConversation[conversationId]).toBe(false);
  });

  it('creates and uses a new active conversation for a first send flow', () => {
    const conversationId = useChatStore.getState().createConversation();

    useChatStore.getState().sendMessage(conversationId, 'I sold 5 chairs to Ahmed for $200 cash');
    advanceMockAssistantResponse();

    const state = useChatStore.getState();
    const conversation = state.conversations.find((item) => item.id === conversationId);
    const messages = getMessages(conversationId);

    expect(state.activeConversationId).toBe(conversationId);
    expect(conversation?.title).toBe('I sold 5 chairs to');
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages[0]?.content).toBe('I sold 5 chairs to Ahmed for $200 cash');
    expect(messages[1]?.status).toBe('sent');
  });

  it('completes the local assistant mock response without persistence wording', () => {
    const conversationId = getActiveConversationId();

    useChatStore.getState().sendMessage(conversationId, 'I sold 5 chairs to Ahmed for $200 cash');
    advanceMockAssistantResponse();

    const assistantMessage = selectLastMessage(conversationId);

    expect(assistantMessage).toMatchObject({
      role: 'assistant',
      status: 'sent',
    });
    expect(assistantMessage?.content).toContain('AI tool execution is not connected yet');
    expect(assistantMessage?.content).not.toMatch(assistantPersistenceWords);
  });

  it('uses suggested prompt selection as a draft update before explicit send', () => {
    const conversationId = getActiveConversationId();
    const prompt = suggestedPrompts[0]?.prompt;

    expect(prompt).toBeDefined();

    useChatStore.getState().setComposerDraft(conversationId, prompt ?? '');

    expect(useChatStore.getState().composerDrafts[conversationId]).toBe(prompt);

    useChatStore.getState().sendMessage(conversationId, prompt ?? '');

    expect(selectLastMessage(conversationId)).toMatchObject({
      content: prompt,
      role: 'user',
    });
  });

  it('creates a failed local error state for simulate error', () => {
    const conversationId = getActiveConversationId();

    useChatStore.getState().sendMessage(conversationId, 'simulate error');
    vi.advanceTimersByTime(850);

    const errorMessage = selectLastMessage(conversationId);

    expect(errorMessage).toMatchObject({
      content: 'The local mock response failed before completion.',
      role: 'error',
      status: 'failed',
    });
    expect(errorMessage?.errorMessage).toContain('Retry will run the local assistant response again');
    expect(useChatStore.getState().typingByConversation[conversationId]).toBe(false);
  });

  it('retries a failed local mock response and keeps message ordering stable', () => {
    const conversationId = getActiveConversationId();

    useChatStore.getState().sendMessage(conversationId, 'simulate error');
    vi.advanceTimersByTime(850);

    const failedMessage = selectLastMessage(conversationId);

    expect(failedMessage?.status).toBe('failed');

    useChatStore.getState().retryMessage(conversationId, failedMessage?.id ?? '');

    expect(getMessages(conversationId).some((message) => message.id === failedMessage?.id)).toBe(
      false,
    );
    expect(useChatStore.getState().typingByConversation[conversationId]).toBe(true);

    vi.advanceTimersByTime(700);

    expect(selectLastMessage(conversationId)).toMatchObject({
      role: 'assistant',
      status: 'streaming',
    });

    vi.advanceTimersByTime(1_100);

    const messages = getMessages(conversationId);
    const finalMessage = messages.at(-1);
    const retriedUserIndex = messages.findIndex(
      (message) => message.role === 'user' && message.content === 'simulate error',
    );
    const finalAssistantIndex = messages.findIndex((message) => message.id === finalMessage?.id);

    expect(finalMessage).toMatchObject({
      role: 'assistant',
      status: 'sent',
    });
    expect(retriedUserIndex).toBeGreaterThanOrEqual(0);
    expect(finalAssistantIndex).toBeGreaterThan(retriedUserIndex);
  });

  it('clears a conversation locally and shows a local-only confirmation', () => {
    const conversationId = getActiveConversationId();

    useChatStore.getState().clearConversation(conversationId);

    const messages = getMessages(conversationId);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      content: 'Conversation cleared locally. No backend records were changed.',
      role: 'system',
      status: 'sent',
    });
    expect(useChatStore.getState().composerDrafts[conversationId]).toBe('');
    expect(useChatStore.getState().typingByConversation[conversationId]).toBe(false);
  });
});
