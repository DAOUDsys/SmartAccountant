# Product Spec

## Product Vision

### Mission

Finance AI is an AI Accountant for small businesses. Its mission is to let owners, freelancers, and operators describe real business events in natural language and have the system turn those events into accurate accounting records, statements, reports, and exports.

The product is not a budgeting app and should not be designed around manual finance dashboards first. The AI assistant is the primary interface.

### Target Audience

- Small shop owners who need to record daily sales, expenses, stock movement, and customer payments quickly.
- Freelancers who need simple accounting support without learning bookkeeping software.
- Service businesses that need to track clients, invoices, payments, expenses, and profitability.
- Retail stores that need sales, purchases, inventory checks, customer statements, and printable records.

### Core Philosophy

The user should be able to speak or type business events the same way they would explain them to a human accountant.

Example:

```text
I sold 5 chairs to Ahmed for $200 cash.
```

The system should eventually understand the intent, extract accounting structure, call the correct backend functions, store the result, and reply naturally with a clear confirmation.

Traditional forms are secondary tools. They exist for review, correction, advanced editing, and accessibility, not as the main workflow.

### Primary User Experience

The chat interface is the heart of the application. The first meaningful product surface should help users:

- Start a conversation with the AI Accountant.
- Record transactions by text or voice.
- Ask questions about customers, inventory, expenses, and profit.
- Review what the AI understood before important records are finalized.
- Correct mistakes conversationally.
- Export or share documents when needed.

Dashboards, charts, and reports are supporting experiences. They should answer questions and summarize business state, but they should not replace the assistant as the main interface.

### Business Goals

- Reduce the time required to record daily accounting events.
- Reduce the number of fields a user must manually enter.
- Make accounting usable for non-accountants.
- Increase trust through transparent confirmations, review states, and clear audit trails.
- Build a foundation for reliable AI-assisted bookkeeping, inventory tracking, reporting, and document export.

## Core User Journeys

### Record Sale

**User Goal:** Record a sale quickly without opening a sales form.

**AI Behavior:** Understand the sold item, quantity, customer, amount, payment method, date if mentioned, and any missing details. Ask a short clarification only when the sale cannot be recorded safely.

**Backend Actions:** Eventually create a sale transaction, update customer balance if relevant, update inventory if the product is tracked, and store an audit trail of the AI interpretation.

**Expected Result:** The user receives a natural confirmation such as: "Recorded a cash sale of 5 chairs to Ahmed for $200."

### Record Expense

**User Goal:** Capture a business expense while it is fresh.

**AI Behavior:** Identify the vendor or payee, amount, category, payment method, date, and attachment context if provided.

**Backend Actions:** Eventually create an expense transaction, categorize it, attach supporting documents when present, and flag uncertain categorization for review.

**Expected Result:** The expense is recorded with minimal manual input and a clear confirmation.

### Record Purchase

**User Goal:** Record goods or supplies purchased for the business.

**AI Behavior:** Distinguish between inventory purchases, operating expenses, and supplier credit. Extract supplier, items, quantities, cost, payment terms, and date.

**Backend Actions:** Eventually create the purchase record, update supplier balance if unpaid, and increase stock quantities for inventory items.

**Expected Result:** The purchase is stored and stock/accounting impact is visible for review.

### Record Customer Payment

**User Goal:** Record money received from a customer.

**AI Behavior:** Identify the customer, amount, payment method, invoice or statement context if provided, and whether the payment settles an existing balance.

**Backend Actions:** Eventually create a payment transaction, apply it against the customer balance, and update statements.

**Expected Result:** The customer balance is updated and the user sees a concise confirmation.

### Check Customer Statement

**User Goal:** Ask what a customer owes or request a customer statement.

**AI Behavior:** Resolve the customer name, summarize balance and recent activity, and offer export or sharing options when relevant.

**Backend Actions:** Eventually retrieve customer transactions, calculate opening balance, payments, sales, adjustments, and closing balance.

**Expected Result:** The user receives a readable statement summary and can export a PDF in a later phase.

### Inventory Audit

**User Goal:** Check or correct stock quantities through conversation.

**AI Behavior:** Understand counted quantities, identify product names, highlight differences from system stock, and ask for confirmation before adjustments.

**Backend Actions:** Eventually compare counted stock with expected stock, create adjustment records, and preserve reason and audit metadata.

**Expected Result:** Inventory remains accurate and every stock correction has an explanation.

### Export PDF

**User Goal:** Generate a professional PDF for a statement, report, receipt, or inventory list.

**AI Behavior:** Understand the requested document, date range, customer or report scope, and preferred sharing format.

**Backend Actions:** Eventually generate a PDF from approved templates and store or share the resulting file.

**Expected Result:** The user receives a polished export ready for printing or sending.

### Ask Business Questions

**User Goal:** Ask plain-language business questions such as "How much did I sell this week?" or "What does Ahmed owe me?"

**AI Behavior:** Translate the question into safe data queries, explain the answer simply, and show source context where useful.

**Backend Actions:** Eventually retrieve relevant transactions, balances, inventory records, and reports without changing data.

**Expected Result:** The user gets an accurate answer without navigating reports manually.

## MVP Scope

### Must Have

- AI-first chat interface as the primary application surface.
- Conversation list and conversation history.
- Message bubbles for user and assistant messages.
- Typing indicator and streaming response presentation.
- Suggested prompts for common accounting actions.
- Voice input button as a UI affordance for future speech-to-text.
- Attachment button as a UI placeholder for future receipt/document support.
- Markdown rendering for assistant replies.
- Empty, loading, error, and retry states.
- Dark mode support and responsive layout.
- Authentication after the chat experience is designed.
- Backend foundations for future conversation storage and accounting operations.

### Should Have

- Customer and supplier selection helpers inside chat.
- Review cards for AI-extracted accounting data before save.
- Basic transaction, customer, supplier, and ledger workflows after AI engine planning.
- Customer statements and basic reports after accounting data exists.
- PDF export after reports and statements are defined.

### Future Versions

- Budgets.
- Goals.
- AI insights.
- Advanced analytics.
- Offline support.
- Notifications.
- Full voice commands and audio recording.
- Bank integrations.
- Multi-user approvals.
- Advanced inventory forecasting.

Budgets, goals, and AI insights are not MVP features.

## AI-First Principles

- The chat interface is the heart of the application.
- Voice input is another way of chatting, not a separate workflow.
- Every accounting operation should eventually be executable through natural language.
- Traditional forms exist only as secondary tools for review, correction, power-user entry, and accessibility.
- The AI should ask only necessary clarifying questions.
- The AI should confirm important accounting actions before or after execution depending on risk.
- The system should preserve auditability: what the user said, what the AI understood, what tool was called, and what changed.
- Dashboards and reports should support the assistant, not compete with it as the main product experience.

## Functional Modules

### Authentication

**Purpose:** Protect user data and prepare the system for business ownership boundaries.

**Responsibilities:** Sign in, sign up, session handling, account recovery, and future organization membership.

**Future Extensions:** Role-based access, accountant collaboration, approval permissions, and device/session management.

### Chat

**Purpose:** Provide the primary user interface for the AI Accountant.

**Responsibilities:** Conversation list, message history, message composer, suggested prompts, streaming responses, empty states, error states, retry states, attachments placeholder, and voice entry point.

**Future Extensions:** Rich accounting confirmation cards, inline correction flows, pinned conversations, shared conversations, and searchable history.

### AI Orchestrator

**Purpose:** Convert natural language into structured accounting intent and safe system actions.

**Responsibilities:** Prompt building, model routing, structured outputs, tool calling, conversation context, validation, and response generation.

**Future Extensions:** Multi-step planning, confidence scoring, model fallback, language localization, audit explanations, and human review queues.

### Accounting Engine

**Purpose:** Maintain accurate accounting records behind AI-assisted workflows.

**Responsibilities:** Transactions, customers, suppliers, ledger entries, payment allocation, balances, and accounting validation rules.

**Future Extensions:** Multi-currency, tax handling, reconciliation, accountant review, and period closing.

### Inventory

**Purpose:** Track products and stock movement caused by sales, purchases, and audits.

**Responsibilities:** Products, quantities, stock adjustments, purchases, sales impact, and inventory audit records.

**Future Extensions:** Barcode scanning, reorder alerts, stock valuation, warehouses, and inventory forecasting.

### Reports

**Purpose:** Turn accounting and inventory data into clear business summaries.

**Responsibilities:** Customer statements, inventory reports, profit and loss, expense reports, and balance summaries.

**Future Extensions:** Comparative periods, scheduled reports, drill-down explanations, and AI-generated report narratives.

### PDF Export

**Purpose:** Produce professional documents for customers, suppliers, and business records.

**Responsibilities:** PDF templates, rendering, sharing, printing readiness, and export history.

**Future Extensions:** Branded templates, multi-language documents, digital signatures, and automated report packs.

### Dashboard

**Purpose:** Provide a secondary overview of business health.

**Responsibilities:** KPIs, charts, quick summaries, alerts, and shortcuts back into chat workflows.

**Future Extensions:** Custom widgets, role-based dashboards, predictive analytics, and AI-generated summaries.

### Settings

**Purpose:** Let users configure business, app, and accounting preferences.

**Responsibilities:** Business profile, currency, language, theme, notification preferences, and future accounting settings.

**Future Extensions:** Fiscal year settings, tax rules, invoice branding, team management, and integrations.

### Voice

**Purpose:** Allow users to interact with the AI Accountant by speaking naturally.

**Responsibilities:** Voice input button, future speech-to-text, recording state, permissions, and voice command handling.

**Future Extensions:** Audio history, multilingual speech recognition, hands-free workflows, and spoken assistant responses.

## User Personas

### Small Shop Owner

Needs to record sales, expenses, purchases, and customer payments quickly throughout the day. They value speed, simple language, and confidence that records are accurate.

### Freelancer

Needs to track clients, payments, expenses, and simple profit without learning accounting terminology. They value clear summaries and low setup effort.

### Service Business

Needs customer balances, service income, supplier expenses, and professional statements. They value reliable customer records and easy document export.

### Retail Store

Needs sales, purchases, stock counts, supplier balances, and inventory reports. They value inventory accuracy and fast daily entry through chat or voice.

## Success Metrics

- Median time to record a transaction.
- Number of manual inputs required per transaction.
- Percentage of transactions created from chat or voice.
- Accuracy of AI categorization and extraction.
- User correction rate after AI interpretation.
- Conversation-to-completed-action rate.
- Weekly retention for active businesses.
- Number of customer statements or PDFs exported.
- Time required to answer common business questions.
- User trust score from confirmation and correction flows.
