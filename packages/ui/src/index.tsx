import type { ReactNode } from 'react';
import { Button, Card, H2, Paragraph, Text, XStack, YStack } from 'tamagui';

interface AppShellProps {
  children: ReactNode;
}

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

interface MetricCardProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'warning';
}

export function AppShell({ children }: AppShellProps) {
  return (
    <YStack backgroundColor="$background" flex={1} padding="$4" space="$4">
      {children}
    </YStack>
  );
}

export function Section({ children, description, title }: SectionProps) {
  return (
    <YStack space="$3">
      <YStack space="$1">
        <H2 size="$6">{title}</H2>
        {description ? <Paragraph color="$gray10">{description}</Paragraph> : null}
      </YStack>
      {children}
    </YStack>
  );
}

export function MetricCard({ label, tone = 'neutral', value }: MetricCardProps) {
  const borderColor = tone === 'positive' ? '$green8' : tone === 'warning' ? '$yellow8' : '$gray7';

  return (
    <Card bordered borderColor={borderColor} padding="$4" width="100%">
      <YStack space="$2">
        <Text color="$gray10" fontSize="$3">
          {label}
        </Text>
        <Text fontSize="$8" fontWeight="700">
          {value}
        </Text>
      </YStack>
    </Card>
  );
}

export function PrimaryActionButton({ children }: { children: ReactNode }) {
  return (
    <Button size="$4" theme="active">
      {children}
    </Button>
  );
}

export function InlineStatus({ label, value }: { label: string; value: string }) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Text color="$gray10">{label}</Text>
      <Text fontWeight="600">{value}</Text>
    </XStack>
  );
}
