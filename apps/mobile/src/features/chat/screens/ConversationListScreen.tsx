import { useMemo, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search } from '@tamagui/lucide-icons';
import { Button, H1, Input, Paragraph, Text, XStack, YStack } from 'tamagui';
import { ChatHeader } from '../components/ChatHeader';
import { ConversationListEmptyState } from '../components/ChatEmptyState';
import { ConversationCard } from '../components/ConversationCard';
import { useChatStore } from '../store/chat.store';

export function ConversationListScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const conversations = useChatStore((state) => state.conversations);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      [conversation.title, conversation.subtitle, conversation.lastMessagePreview]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [conversations, query]);

  const openConversation = (conversationId: string) => {
    setActiveConversation(conversationId);
    router.push(`/chat/${conversationId}`);
  };

  const handleCreateConversation = () => {
    const conversationId = createConversation();
    router.push(`/chat/${conversationId}`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 650);
  };

  return (
    <YStack backgroundColor="$background" flex={1}>
      <ChatHeader
        onOpenSettings={handleCreateConversation}
        subtitle="Chat-first accounting workspace"
        title="AI Accountant"
      />

      <FlatList
        ListEmptyComponent={
          <ConversationListEmptyState onCreateConversation={handleCreateConversation} />
        }
        ListHeaderComponent={
          <YStack paddingBottom="$3" space="$3">
            <YStack space="$2">
              <H1 color="$color" fontSize={44} lineHeight={52}>
                Finance AI
              </H1>
              <Paragraph color="$gray11" lineHeight={24} size="$4">
                Describe business events naturally. The assistant will later turn them into
                validated accounting actions.
              </Paragraph>
            </YStack>

            <XStack alignItems="center" gap="$2">
              <XStack
                alignItems="center"
                backgroundColor="$gray3"
                borderColor="$gray6"
                borderRadius="$5"
                borderWidth={1}
                flex={1}
                minHeight={48}
                paddingHorizontal="$3"
                space="$2"
              >
                <Search color="$gray10" size={18} />
                <Input
                  accessibilityLabel="Search conversations"
                  backgroundColor="transparent"
                  borderWidth={0}
                  flex={1}
                  height={44}
                  onChangeText={setQuery}
                  paddingHorizontal={0}
                  placeholder="Search conversations"
                  value={query}
                />
              </XStack>
              <Button
                accessibilityLabel="Create new chat"
                icon={Plus}
                minHeight={48}
                onPress={handleCreateConversation}
                paddingHorizontal="$3"
                size="$3"
                theme="active"
              >
                <Text fontWeight="700">New</Text>
              </Button>
            </XStack>
          </YStack>
        }
        contentContainerStyle={{
          flexGrow: 1,
          gap: 10,
          padding: 16,
          paddingBottom: 24,
        }}
        data={filteredConversations}
        keyExtractor={(conversation) => conversation.id}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />}
        renderItem={({ item }) => (
          <ConversationCard conversation={item} onPress={() => openConversation(item.id)} />
        )}
      />
    </YStack>
  );
}
