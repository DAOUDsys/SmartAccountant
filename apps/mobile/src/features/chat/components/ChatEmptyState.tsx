import { Bot, MessageCircle } from '@tamagui/lucide-icons';
import { Button, H2, Paragraph, XStack, YStack } from 'tamagui';
import { suggestedPrompts } from '../data/mock-chat-data';
import { SuggestedPromptChips } from './SuggestedPromptChips';

interface ChatEmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export function ChatEmptyState({ onSelectPrompt }: ChatEmptyStateProps) {
  return (
    <YStack alignItems="center" flex={1} justifyContent="center" padding="$5" space="$4">
      <YStack
        alignItems="center"
        backgroundColor="$gray3"
        borderColor="$gray6"
        borderRadius="$8"
        borderWidth={1}
        padding="$4"
        space="$3"
        width="100%"
      >
        <Bot color="$blue10" size={34} />
        <YStack alignItems="center" space="$2">
          <H2 size="$7" textAlign="center">
            Ask your AI Accountant
          </H2>
          <Paragraph color="$gray11" textAlign="center">
            Describe a sale, expense, customer payment, stock check, or report request in plain
            language.
          </Paragraph>
        </YStack>
        <XStack alignItems="center" space="$2">
          <MessageCircle color="$gray10" size={16} />
          <Paragraph color="$gray10" size="$3">
            Local preview only. Backend records stay unchanged.
          </Paragraph>
        </XStack>
      </YStack>

      <YStack space="$2" width="100%">
        <Paragraph color="$gray11" size="$3">
          Suggested prompts
        </Paragraph>
        <SuggestedPromptChips onSelectPrompt={onSelectPrompt} prompts={suggestedPrompts} />
      </YStack>
    </YStack>
  );
}

interface ConversationListEmptyStateProps {
  onCreateConversation: () => void;
}

export function ConversationListEmptyState({
  onCreateConversation,
}: ConversationListEmptyStateProps) {
  return (
    <YStack
      alignItems="center"
      backgroundColor="$gray3"
      borderColor="$gray6"
      borderRadius="$4"
      borderWidth={1}
      padding="$5"
      space="$3"
    >
      <Bot color="$blue10" size={32} />
      <H2 size="$6" textAlign="center">
        Start with a business event
      </H2>
      <Paragraph color="$gray11" textAlign="center">
        Create a chat and type something like a sale, expense, stock check, or statement request.
      </Paragraph>
      <Button accessibilityLabel="Create new chat" onPress={onCreateConversation} theme="active">
        New Chat
      </Button>
    </YStack>
  );
}
