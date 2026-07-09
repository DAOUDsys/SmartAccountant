import { Activity } from '@tamagui/lucide-icons';
import { Paragraph, XStack } from 'tamagui';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <XStack alignItems="center" space="$2">
      <Activity color="$blue10" size={16} />
      <Paragraph color="$gray11" size="$3">
        {content}
      </Paragraph>
    </XStack>
  );
}
