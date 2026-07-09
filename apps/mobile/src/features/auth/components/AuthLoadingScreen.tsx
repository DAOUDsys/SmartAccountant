import { ActivityIndicator } from 'react-native';
import { Paragraph, YStack } from 'tamagui';

export function AuthLoadingScreen() {
  return (
    <YStack
      alignItems="center"
      backgroundColor="$background"
      flex={1}
      gap="$3"
      justifyContent="center"
      padding="$5"
    >
      <ActivityIndicator />
      <Paragraph color="$gray11">Restoring secure session...</Paragraph>
    </YStack>
  );
}
