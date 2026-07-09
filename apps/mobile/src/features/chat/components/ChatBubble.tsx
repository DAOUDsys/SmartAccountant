import Markdown from 'react-native-markdown-display';
import { AlertTriangle, Bot, Clock } from '@tamagui/lucide-icons';
import { Paragraph, Text, useTheme, XStack, YStack } from 'tamagui';
import type { ChatMessage } from '../types/chat.types';
import { formatMessageTime } from '../utils/message-formatters';
import { MessageRetryButton } from './MessageRetryButton';
import { StreamingMessage } from './StreamingMessage';

interface ChatBubbleProps {
  message: ChatMessage;
  onRetry: () => void;
}

export function ChatBubble({ message, onRetry }: ChatBubbleProps) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';
  const isError = message.role === 'error' || message.status === 'failed';
  const alignSelf = isUser ? 'flex-end' : 'flex-start';
  const maxWidth = isSystem ? '100%' : '86%';
  const width = isSystem ? '100%' : isAssistant ? '86%' : undefined;
  const backgroundColor = isUser
    ? '$blue9'
    : isError
      ? '$red3'
      : isSystem
        ? '$gray3'
        : '$background';
  const borderColor = isUser ? '$blue9' : isError ? '$red7' : '$gray6';
  const textColor = isUser ? '$color1' : isError ? '$red11' : '$color';

  const markdownStyles = {
    body: {
      color: theme.color?.val,
      fontSize: 15,
      lineHeight: 22,
    },
    bullet_list: {
      marginBottom: 8,
    },
    bullet_list_icon: {
      color: theme.blue10?.val,
    },
    code_inline: {
      backgroundColor: theme.gray4?.val,
      borderRadius: 4,
      color: theme.color?.val,
      paddingHorizontal: 4,
    },
    fence: {
      backgroundColor: theme.gray3?.val,
      borderColor: theme.gray6?.val,
      borderRadius: 6,
      borderWidth: 1,
      color: theme.color?.val,
      padding: 10,
    },
    heading1: {
      color: theme.color?.val,
      fontSize: 20,
      fontWeight: '700' as const,
      marginBottom: 8,
    },
    heading2: {
      color: theme.color?.val,
      fontSize: 18,
      fontWeight: '700' as const,
      marginBottom: 6,
    },
    paragraph: {
      marginBottom: 8,
      marginTop: 0,
    },
    table: {
      borderColor: theme.gray6?.val,
      borderRadius: 6,
      borderWidth: 1,
      marginBottom: 8,
    },
    td: {
      borderColor: theme.gray6?.val,
      color: theme.color?.val,
      padding: 6,
    },
    th: {
      borderColor: theme.gray6?.val,
      color: theme.color?.val,
      fontWeight: '700' as const,
      padding: 6,
    },
  };

  return (
    <YStack
      alignSelf={alignSelf}
      maxWidth={maxWidth}
      space="$1"
      width={width}
    >
      <YStack
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        borderRadius="$5"
        borderWidth={1}
        padding="$3"
        space="$2"
      >
        {message.status === 'streaming' ? (
          <StreamingMessage content={message.content} />
        ) : isAssistant ? (
          <XStack alignItems="flex-start" space="$2" width="100%">
            <Bot color="$blue10" size={16} />
            <YStack flex={1} width="100%">
              <Markdown style={markdownStyles}>{message.content}</Markdown>
            </YStack>
          </XStack>
        ) : isError ? (
          <YStack space="$2">
            <XStack alignItems="center" space="$2">
              <AlertTriangle color="$red10" size={16} />
              <Text color="$red11" fontWeight="700">
                Message failed
              </Text>
            </XStack>
            <Paragraph color="$red11">{message.errorMessage ?? message.content}</Paragraph>
            <MessageRetryButton onRetry={onRetry} />
          </YStack>
        ) : (
          <Paragraph color={textColor} size="$4">
            {message.content}
          </Paragraph>
        )}
      </YStack>

      {!isSystem ? (
        <XStack
          alignItems="center"
          alignSelf={isUser ? 'flex-end' : 'flex-start'}
          paddingHorizontal="$2"
          space="$1"
        >
          {message.status === 'pending' ? <Clock color="$gray9" size={12} /> : null}
          <Text color="$gray10" fontSize="$1">
            {formatMessageTime(message.createdAt)}
          </Text>
        </XStack>
      ) : null}
    </YStack>
  );
}
