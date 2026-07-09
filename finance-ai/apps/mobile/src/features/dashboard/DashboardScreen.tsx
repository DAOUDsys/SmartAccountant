import { ScrollView } from 'react-native';
import { AppShell, InlineStatus, MetricCard, PrimaryActionButton, Section } from '@finance-ai/ui';
import { createCurrentMonthRange, formatCurrency } from '@finance-ai/utils';
import { YStack } from 'tamagui';
import { useAppStore } from '../../store/app.store';
import { appRoutes } from '../../navigation/app-routes';

const reportingRange = createCurrentMonthRange();

export function DashboardScreen() {
  const apiBaseUrl = useAppStore((state) => state.apiBaseUrl);
  const backendStatus = useAppStore((state) => state.backendStatus);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <AppShell>
        <Section
          title="Finance AI"
          description="Project foundation is ready for accounting workflows, AI services, and production hardening."
        >
          <YStack space="$3">
            <MetricCard
              label="Foundation balance"
              tone="positive"
              value={formatCurrency({ amount: 0, currency: 'USD' })}
            />
            <InlineStatus label="API URL" value={apiBaseUrl} />
            <InlineStatus label="Backend" value={backendStatus} />
            <InlineStatus
              label="Current range"
              value={`${reportingRange.from} to ${reportingRange.to}`}
            />
          </YStack>
        </Section>

        <Section title="Workspace Modules">
          <YStack space="$2">
            <InlineStatus label={appRoutes.accounts} value="Module boundary ready" />
            <InlineStatus label={appRoutes.transactions} value="Module boundary ready" />
            <InlineStatus label={appRoutes.reports} value="Module boundary ready" />
            <InlineStatus label={appRoutes.aiAssistant} value="Module boundary ready" />
          </YStack>
        </Section>

        <PrimaryActionButton>Open Dashboard</PrimaryActionButton>
      </AppShell>
    </ScrollView>
  );
}
