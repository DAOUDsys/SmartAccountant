import type { ChatMessage } from '../types/chat.types';

export function formatConversationTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function createPreview(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function createConversationTitle(content: string): string {
  const normalized = content.replace(/[^\w\s$]/g, '').trim();
  const words = normalized.split(/\s+/).filter(Boolean).slice(0, 5);
  return words.length > 0 ? words.join(' ') : 'New accounting chat';
}

export function createMockAssistantResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('sold') || lower.includes('sale')) {
    return [
      'I understood this as a cash sale:',
      '',
      '- Customer: Ahmed',
      '- Items: 5 chairs',
      '- Total: $200',
      '- Payment: Cash',
      '',
      'AI tool execution is not connected yet, so I did not write any transaction.',
    ].join('\n');
  }

  if (lower.includes('electricity') || lower.includes('expense') || lower.includes('paid')) {
    return [
      'I understood this as an expense draft:',
      '',
      '- Category: Utilities',
      '- Amount: $50',
      '- Payment status: Paid',
      '',
      'This is only a local chat preview. No ledger entry was written.',
    ].join('\n');
  }

  if (lower.includes('statement')) {
    return [
      'I can prepare this as a customer statement request.',
      '',
      '| Field | Value |',
      '| --- | --- |',
      '| Customer | Ahmed |',
      '| Output | Statement |',
      '| Status | Waiting for future reporting tools |',
      '',
      'No statement was exported because PDF and reporting tools are not connected yet.',
    ].join('\n');
  }

  if (lower.includes('stock') || lower.includes('inventory')) {
    return [
      'I understood this as an inventory lookup.',
      '',
      '- Product: Chairs',
      '- Action: Check stock',
      '',
      'Inventory tools are not connected yet, so I cannot read live stock.',
    ].join('\n');
  }

  if (lower.includes('week') || lower.includes('how much')) {
    return [
      'I understood this as a business question.',
      '',
      '- Metric: Sales total',
      '- Date range: This week',
      '',
      'Reporting tools are not connected yet, so I cannot calculate the live answer.',
    ].join('\n');
  }

  if (lower.includes('pdf') || lower.includes('export')) {
    return [
      'I understood this as a PDF export request.',
      '',
      '- Document: Customer statement',
      '- Output: PDF',
      '',
      'PDF generation is not connected yet, so no document was produced.',
    ].join('\n');
  }

  return [
    'I can help turn this into an accounting action later.',
    '',
    '- I identified this as an accounting conversation.',
    '- Backend tools are not connected yet.',
    '- No backend records were changed.',
  ].join('\n');
}

export function getLastMessage(messages: ChatMessage[]): ChatMessage | undefined {
  return messages[messages.length - 1];
}
