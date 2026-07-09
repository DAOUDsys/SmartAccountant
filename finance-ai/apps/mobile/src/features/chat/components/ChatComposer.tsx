import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from 'react-native';
import { Mic, Paperclip, Send } from '@tamagui/lucide-icons';
import { Button, XStack, YStack, useTheme } from 'tamagui';

interface ChatComposerProps {
  disabled?: boolean;
  draft: string;
  onChangeDraft: (draft: string) => void;
  onSend: () => void;
}

export function ChatComposer({
  disabled = false,
  draft,
  onChangeDraft,
  onSend,
}: ChatComposerProps) {
  const canSend = draft.trim().length > 0 && !disabled;
  const theme = useTheme();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <YStack
        backgroundColor="$background"
        borderTopColor="$gray6"
        borderTopWidth={1}
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$4"
        space="$3"
      >
        <XStack alignItems="flex-end" space="$2">
          <Button
            accessibilityLabel="Attach file placeholder"
            chromeless
            circular
            disabled={disabled}
            icon={Paperclip}
            opacity={0.65}
            size="$3"
          />
          <TextInput
            accessibilityLabel="Message composer"
            editable={!disabled}
            multiline
            onChangeText={onChangeDraft}
            placeholder="Tell your AI Accountant what happened..."
            placeholderTextColor={String(theme.gray10?.val ?? '#6f6f6f')}
            style={[
              styles.input,
              {
                backgroundColor: String(theme.gray3?.val ?? '#f2f2f2'),
                borderColor: String(theme.gray7?.val ?? '#c8c8c8'),
                color: String(theme.color?.val ?? '#111111'),
              },
            ]}
            textAlignVertical="center"
            value={draft}
          />
          <Button
            accessibilityLabel="Voice input placeholder"
            chromeless
            circular
            disabled={disabled}
            icon={Mic}
            opacity={0.75}
            size="$3"
          />
          <Button
            accessibilityLabel="Send message"
            circular
            disabled={!canSend}
            icon={Send}
            onPress={onSend}
            opacity={canSend ? 1 : 0.45}
            size="$3"
            theme="active"
          />
        </XStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 132,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
