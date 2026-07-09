import { ArrowLeft, Bot, LogOut, Settings } from '@tamagui/lucide-icons';
import { Button, Circle, Paragraph, Text, XStack, YStack } from 'tamagui';

interface ChatHeaderProps {
  onBack?: () => void;
  onLogout?: () => void;
  onOpenSettings: () => void;
  subtitle?: string;
  title: string;
}

export function ChatHeader({ onBack, onLogout, onOpenSettings, subtitle, title }: ChatHeaderProps) {
  return (
    <XStack
      alignItems="center"
      backgroundColor="$background"
      borderBottomColor="$gray6"
      borderBottomWidth={1}
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$3"
      space="$3"
    >
      <XStack alignItems="center" flex={1} space="$3">
        {onBack ? (
          <Button
            accessibilityLabel="Back to conversations"
            chromeless
            circular
            icon={ArrowLeft}
            onPress={onBack}
            size="$3"
          />
        ) : null}
        <Circle backgroundColor="$blue4" size={40}>
          <Bot color="$blue11" size={21} />
        </Circle>
        <YStack flex={1} minWidth={0}>
          <Text color="$color" fontSize="$5" fontWeight="700" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Paragraph color="$gray10" lineHeight={18} numberOfLines={2} size="$2">
              {subtitle}
            </Paragraph>
          ) : null}
        </YStack>
      </XStack>
      <XStack alignItems="center" space="$1">
        {onLogout ? (
          <Button
            accessibilityLabel="Sign out"
            chromeless
            circular
            icon={LogOut}
            onPress={onLogout}
            size="$3"
          />
        ) : null}
        <Button
          accessibilityLabel="Open chat settings"
          chromeless
          circular
          icon={Settings}
          onPress={onOpenSettings}
          size="$3"
        />
      </XStack>
    </XStack>
  );
}
