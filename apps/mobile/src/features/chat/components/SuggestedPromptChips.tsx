import { ScrollView } from 'react-native';
import { Button, XStack } from 'tamagui';
import type { SuggestedPrompt } from '../types/chat.types';

interface SuggestedPromptChipsProps {
  prompts: SuggestedPrompt[];
  onSelectPrompt: (prompt: string) => void;
}

export function SuggestedPromptChips({ onSelectPrompt, prompts }: SuggestedPromptChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <XStack paddingRight="$4" space="$2">
        {prompts.map((prompt) => (
          <Button
            accessibilityLabel={`Use suggested prompt: ${prompt.prompt}`}
            borderColor="$gray7"
            borderRadius="$8"
            key={prompt.id}
            onPress={() => onSelectPrompt(prompt.prompt)}
            size="$3"
            theme="gray"
          >
            {prompt.label}
          </Button>
        ))}
      </XStack>
    </ScrollView>
  );
}
