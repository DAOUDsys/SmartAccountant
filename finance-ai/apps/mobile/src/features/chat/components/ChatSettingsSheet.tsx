import { Download, SlidersHorizontal, Trash2, X } from '@tamagui/lucide-icons';
import { Button, H2, Paragraph, Sheet, Switch, Text, XStack, YStack } from 'tamagui';

interface ChatSettingsSheetProps {
  conciseMode: boolean;
  confirmBeforeActions: boolean;
  open: boolean;
  onClearConversation: () => void;
  onOpenChange: (open: boolean) => void;
  onToggleConciseMode: () => void;
  onToggleConfirmBeforeActions: () => void;
}

export function ChatSettingsSheet({
  conciseMode,
  confirmBeforeActions,
  onClearConversation,
  onOpenChange,
  onToggleConciseMode,
  onToggleConfirmBeforeActions,
  open,
}: ChatSettingsSheetProps) {
  return (
    <Sheet
      dismissOnSnapToBottom
      modal
      onOpenChange={onOpenChange}
      open={open}
      snapPoints={[54]}
      zIndex={100_000}
    >
      <Sheet.Overlay />
      <Sheet.Frame padding="$4" space="$4">
        <XStack alignItems="center" justifyContent="space-between">
          <YStack>
            <H2 size="$6">Chat Settings</H2>
            <Paragraph color="$gray10" size="$3">
              Local controls for this conversation.
            </Paragraph>
          </YStack>
          <Button
            accessibilityLabel="Close chat settings"
            chromeless
            circular
            icon={X}
            onPress={() => onOpenChange(false)}
            size="$3"
          />
        </XStack>

        <YStack space="$3">
          <XStack
            alignItems="center"
            backgroundColor="$gray3"
            borderRadius="$4"
            justifyContent="space-between"
            padding="$3"
          >
            <YStack flex={1} paddingRight="$3">
              <Text fontWeight="700">Concise assistant replies</Text>
              <Paragraph color="$gray10" size="$2">
                UI-only preference for future behavior.
              </Paragraph>
            </YStack>
            <Switch checked={conciseMode} onCheckedChange={onToggleConciseMode} size="$3">
              <Switch.Thumb />
            </Switch>
          </XStack>

          <XStack
            alignItems="center"
            backgroundColor="$gray3"
            borderRadius="$4"
            justifyContent="space-between"
            padding="$3"
          >
            <YStack flex={1} paddingRight="$3">
              <Text fontWeight="700">Confirm before actions</Text>
              <Paragraph color="$gray10" size="$2">
                Future tool calls should ask before changing accounting records.
              </Paragraph>
            </YStack>
            <Switch
              checked={confirmBeforeActions}
              onCheckedChange={onToggleConfirmBeforeActions}
              size="$3"
            >
              <Switch.Thumb />
            </Switch>
          </XStack>
        </YStack>

        <YStack space="$2">
          <Button
            accessibilityLabel="Clear conversation"
            icon={Trash2}
            onPress={onClearConversation}
            theme="red"
          >
            Clear conversation
          </Button>
          <Button
            accessibilityLabel="Export conversation coming soon"
            disabled
            icon={Download}
            opacity={0.55}
          >
            Export conversation - Coming soon
          </Button>
          <Button
            accessibilityLabel="Assistant behavior coming soon"
            disabled
            icon={SlidersHorizontal}
            opacity={0.55}
          >
            Assistant behavior - Coming soon
          </Button>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}
