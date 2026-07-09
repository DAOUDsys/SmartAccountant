export const appRoutes = {
  accounts: 'Accounts',
  aiAssistant: 'AI Assistant',
  dashboard: 'Dashboard',
  reports: 'Reports',
  transactions: 'Transactions',
} as const;

export type AppRouteKey = keyof typeof appRoutes;
export type AppRouteName = (typeof appRoutes)[AppRouteKey];
