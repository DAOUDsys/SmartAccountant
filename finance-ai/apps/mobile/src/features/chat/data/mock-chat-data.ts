import type { ChatMessage, Conversation, SuggestedPrompt } from '../types/chat.types';

const now = new Date('2026-07-08T13:00:00.000Z');

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export const suggestedPrompts: SuggestedPrompt[] = [
  {
    id: 'sold-chairs',
    label: 'Sale',
    prompt: 'I sold 5 chairs to Ahmed for $200 cash',
  },
  {
    id: 'paid-electricity',
    label: 'Expense',
    prompt: 'Paid $50 for electricity',
  },
  {
    id: 'customer-statement',
    label: 'Statement',
    prompt: "Show Ahmed's statement",
  },
  {
    id: 'weekly-sales',
    label: 'Sales',
    prompt: 'How much did I sell this week?',
  },
  {
    id: 'stock-check',
    label: 'Stock',
    prompt: 'Check stock for chairs',
  },
  {
    id: 'export-pdf',
    label: 'PDF',
    prompt: 'Export customer statement as PDF',
  },
];

export const mockConversations: Conversation[] = [
  {
    id: 'conversation_daily_sales',
    title: 'Daily sales review',
    subtitle: 'Cash sales and customer balances',
    lastMessagePreview: 'I can prepare this as a sale draft once tool execution is connected.',
    createdAt: minutesAgo(130),
    updatedAt: minutesAgo(14),
    unreadCount: 1,
    status: 'review',
  },
  {
    id: 'conversation_inventory',
    title: 'Inventory check',
    subtitle: 'Stock questions for shop items',
    lastMessagePreview: 'Chairs need product lookup before inventory can be verified.',
    createdAt: minutesAgo(380),
    updatedAt: minutesAgo(92),
    unreadCount: 0,
    status: 'active',
  },
  {
    id: 'conversation_expenses',
    title: 'Expense capture',
    subtitle: 'Utilities and supplier payments',
    lastMessagePreview: 'Electricity can be reviewed as an operating expense.',
    createdAt: minutesAgo(900),
    updatedAt: minutesAgo(260),
    unreadCount: 0,
    status: 'active',
  },
];

export const mockMessagesByConversation: Record<string, ChatMessage[]> = {
  conversation_daily_sales: [
    {
      id: 'msg_sales_user_1',
      conversationId: 'conversation_daily_sales',
      role: 'user',
      content: 'I sold 5 chairs to Ahmed for $200 cash.',
      createdAt: minutesAgo(18),
      status: 'sent',
    },
    {
      id: 'msg_sales_assistant_1',
      conversationId: 'conversation_daily_sales',
      role: 'assistant',
      content:
        'I understood this as a cash sale:\n\n- Customer: Ahmed\n- Items: 5 chairs\n- Total: $200\n- Payment: Cash\n\nAI tool execution is not connected yet, so I did not write any transaction.',
      createdAt: minutesAgo(17),
      status: 'sent',
    },
    {
      id: 'msg_sales_system_1',
      conversationId: 'conversation_daily_sales',
      role: 'system',
      content: 'Future backend execution will require duplicate checks and confidence validation.',
      createdAt: minutesAgo(16),
      status: 'sent',
    },
  ],
  conversation_inventory: [
    {
      id: 'msg_inventory_user_1',
      conversationId: 'conversation_inventory',
      role: 'user',
      content: 'Check stock for chairs',
      createdAt: minutesAgo(98),
      status: 'sent',
    },
    {
      id: 'msg_inventory_assistant_1',
      conversationId: 'conversation_inventory',
      role: 'assistant',
      content:
        'I can treat this as an inventory question.\n\n| Field | Value |\n| --- | --- |\n| Product | Chairs |\n| Action | Stock lookup |\n\nInventory tools are not connected yet, so I cannot read live stock.',
      createdAt: minutesAgo(97),
      status: 'sent',
    },
  ],
  conversation_expenses: [
    {
      id: 'msg_expenses_user_1',
      conversationId: 'conversation_expenses',
      role: 'user',
      content: 'Paid $50 for electricity',
      createdAt: minutesAgo(265),
      status: 'sent',
    },
    {
      id: 'msg_expenses_error_1',
      conversationId: 'conversation_expenses',
      role: 'error',
      content: 'Mock assistant response failed before completion.',
      createdAt: minutesAgo(264),
      status: 'failed',
      errorMessage: 'Local mock failure state for retry UI.',
    },
  ],
};
