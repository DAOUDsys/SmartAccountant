import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Paragraph, YStack } from 'tamagui';
import { ChatBubble } from '../components/ChatBubble';
import { ChatComposer } from '../components/ChatComposer';
import { ChatEmptyState } from '../components/ChatEmptyState';
import { ChatHeader } from '../components/ChatHeader';
import { ChatSettingsSheet } from '../components/ChatSettingsSheet';
import { SuggestedPromptChips } from '../components/SuggestedPromptChips';
import { TypingIndicator } from '../components/TypingIndicator';
import { suggestedPrompts } from '../data/mock-chat-data';
import { useChatStore } from '../store/chat.store';
import type { ChatMessage } from '../types/chat.types';

export function ChatThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const conversation = useChatStore((state) =>
    state.conversations.find((item) => item.id === conversationId),
  );
  const messages = useChatStore((state) => state.messagesByConversation[conversationId] ?? []);
  const draft = useChatStore((state) => state.composerDrafts[conversationId] ?? '');
  const isTyping = useChatStore((state) => state.typingByConversation[conversationId] ?? false);
  const settings = useChatStore((state) => state.settings);
  const clearConversation = useChatStore((state) => state.clearConversation);
  const retryMessage = useChatStore((state) => state.retryMessage);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const setComposerDraft = useChatStore((state) => state.setComposerDraft);
  const toggleConciseMode = useChatStore((state) => state.toggleConciseMode);
  const toggleConfirmBeforeActions = useChatStore((state) => state.toggleConfirmBeforeActions);

  const canSend = useMemo(() => draft.trim().length > 0 && !isTyping, [draft, isTyping]);

  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, setActiveConversation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages.length, isTyping]);

  if (!conversation) {
    return (
      <YStack
        alignItems="center"
        backgroundColor="$background"
        flex={1}
        justifyContent="center"
        padding="$5"
      >
        <Paragraph color="$gray11" textAlign="center">
          This conversation is no longer available.
        </Paragraph>
      </YStack>
    );
  }

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    sendMessage(conversationId, draft);
  };

  const handlePromptSelect = (prompt: string) => {
    setComposerDraft(conversationId, prompt);
  };

  const handleClearConversation = () => {
    clearConversation(conversationId);
    setSettingsOpen(false);
  };

  return (
    <YStack backgroundColor="$background" flex={1}>
      <ChatHeader
        onBack={() => router.back()}
        onOpenSettings={() => setSettingsOpen(true)}
        subtitle="Online preview · tools not connected"
        title={conversation.title}
      />

      {messages.length === 0 ? (
        <ChatEmptyState onSelectPrompt={handlePromptSelect} />
      ) : (
        <FlatList
          ListFooterComponent={
            <YStack paddingTop="$2" space="$3">
              {isTyping ? <TypingIndicator /> : null}
              <SuggestedPromptChips
                onSelectPrompt={handlePromptSelect}
                prompts={suggestedPrompts}
              />
            </YStack>
          }
          contentContainerStyle={{
            gap: 12,
            padding: 16,
            paddingBottom: 20,
          }}
          data={messages}
          keyExtractor={(message) => message.id}
          ref={listRef}
          renderItem={({ item }) => (
            <ChatBubble message={item} onRetry={() => retryMessage(conversationId, item.id)} />
          )}
        />
      )}

      <ChatComposer
        disabled={isTyping}
        draft={draft}
        onChangeDraft={(value) => setComposerDraft(conversationId, value)}
        onSend={handleSend}
      />

      <ChatSettingsSheet
        conciseMode={settings.conciseMode}
        confirmBeforeActions={settings.confirmBeforeActions}
        onClearConversation={handleClearConversation}
        onOpenChange={setSettingsOpen}
        onToggleConciseMode={toggleConciseMode}
        onToggleConfirmBeforeActions={toggleConfirmBeforeActions}
        open={settingsOpen}
      />
    </YStack>
  );
}
