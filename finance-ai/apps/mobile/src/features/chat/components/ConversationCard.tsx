import { Pressable } from 'react-native';
import { Circle, Paragraph, Text, XStack, YStack } from 'tamagui';
import type { Conversation } from '../types/chat.types';
import { formatConversationTime } from '../utils/message-formatters';

interface ConversationCardProps {
  conversation: Conversation;
  onPress: () => void;
}

const statusLabels: Record<Conversation['status'], string> = {
  active: 'Active',
  draft: 'Draft',
  review: 'Review',
};

export function ConversationCard({ conversation, onPress }: ConversationCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Open conversation ${conversation.title}`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
    >
      {({ pressed }) => (
        <YStack
          backgroundColor={pressed ? '$gray2' : '$background'}
          borderColor="$gray7"
          borderRadius="$4"
          borderWidth={1}
          minHeight={132}
          opacity={pressed ? 0.86 : 1}
          paddingHorizontal="$4"
          paddingVertical="$3"
          space="$2.5"
        >
          <XStack alignItems="flex-start" justifyContent="space-between" space="$3">
            <YStack flex={1} minWidth={0} space="$1">
              <XStack alignItems="center" space="$2">
                <Text color="$color" fontSize="$5" fontWeight="700" numberOfLines={1}>
                  {conversation.title}
                </Text>
                {conversation.unreadCount > 0 ? (
                  <Circle backgroundColor="$blue9" size={9} />
                ) : null}
              </XStack>
              <Paragraph color="$gray11" lineHeight={19} numberOfLines={1} size="$3">
                {conversation.subtitle}
              </Paragraph>
            </YStack>
            <Text color="$gray10" fontSize="$2">
              {formatConversationTime(conversation.updatedAt)}
            </Text>
          </XStack>

          <Paragraph color="$gray12" lineHeight={21} numberOfLines={2} size="$3">
            {conversation.lastMessagePreview}
          </Paragraph>

          <XStack alignItems="center" justifyContent="space-between">
            <Text color="$gray10" fontSize="$2">
              {statusLabels[conversation.status]}
            </Text>
            {conversation.unreadCount > 0 ? (
              <Text color="$blue10" fontSize="$2" fontWeight="700">
                {conversation.unreadCount} new
              </Text>
            ) : null}
          </XStack>
        </YStack>
      )}
    </Pressable>
  );
}
