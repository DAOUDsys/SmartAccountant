import { RotateCcw } from '@tamagui/lucide-icons';
import { Button } from 'tamagui';

interface MessageRetryButtonProps {
  onRetry: () => void;
}

export function MessageRetryButton({ onRetry }: MessageRetryButtonProps) {
  return (
    <Button
      accessibilityLabel="Retry message"
      alignSelf="flex-start"
      chromeless
      icon={RotateCcw}
      onPress={onRetry}
      size="$2"
    >
      Retry
    </Button>
  );
}
