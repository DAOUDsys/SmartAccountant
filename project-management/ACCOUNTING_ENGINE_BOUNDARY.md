# Accounting Engine Boundary

## Purpose

SmartAccountant / Finance AI needs a clear accounting engine boundary before ledger tables or posting logic are implemented. The current `Transaction` and `TransactionLine` records are transaction-intent records: they capture what a user or future AI tool wants to represent, but they are not finalized double-entry accounting postings.

This boundary defines how transaction intents will later become validated postings, balanced journal entries, inventory movements, audit events, and safe AI tool execution results. It exists to keep future implementation disciplined: no feature should treat a transaction intent as ledger truth until the accounting engine validates it, posts it atomically, and records the audit trail.

This document is architecture only. It does not implement Prisma schema, migrations, backend APIs, mobile UI, ledger posting, inventory automation, AI orchestration, reports, PDFs, dashboards, budgets, goals, bank connections, or OCR.

## Current State

Already implemented:

- Authentication foundation with hashed passwords, JWT access tokens, hashed refresh tokens, and mobile session handling.
- Tenant-aware authorization with `Business`, `BusinessMember`, roles, membership statuses, membership guards, and active business handling.
- Tenant-scoped customers, suppliers, products, transaction-intent records, and transaction lines.
- `TransactionStatus` values: `DRAFT`, `POSTED`, and `VOIDED`.
- Guarded tenant-scoped APIs for customers, suppliers, products, and transaction-intent records.

Not implemented yet:

- Chart of Accounts.
- Double-entry ledger.
- Journal entries and journal lines.
- Posting engine.
- Account mapping configuration.
- Inventory movement engine.
- Accounting periods.
- Audit log table.
- Report generation.
- PDF export.
- AI tool execution.

Important current-state rule: a `POSTED` transaction status currently means a transaction-intent record has been marked as posted-like by the foundation API. It does not yet mean a balanced journal entry exists. Future posting implementation must either migrate/normalize this status behavior or introduce a stricter posting pathway before reports rely on it.

## Core Accounting Concepts

| Concept            | Definition                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chart of Accounts  | The tenant-scoped list of accounts used to classify assets, liabilities, equity, revenue, and expenses.                                                                   |
| Account            | A named ledger bucket, such as Cash, Accounts Receivable, Sales Revenue, Inventory Asset, or Cost of Goods Sold.                                                          |
| Account Type       | The accounting category of an account: asset, liability, equity, revenue, or expense.                                                                                     |
| Journal Entry      | A balanced accounting event made of journal lines. It is the durable ledger posting produced from a validated source transaction.                                         |
| Journal Line       | One debit or credit line inside a journal entry.                                                                                                                          |
| Debit              | The left-side value in double-entry accounting. Its meaning depends on account type.                                                                                      |
| Credit             | The right-side value in double-entry accounting. Its meaning depends on account type.                                                                                     |
| Posting            | The act of validating a source transaction, resolving accounts, creating balanced journal lines, and marking the source transaction as posted.                            |
| Void / Reversal    | A safe correction pattern for posted entries. Rather than mutating historical lines, the system creates reversing entries and marks source records as voided or reversed. |
| Source Transaction | The tenant-scoped `Transaction` intent record that caused a journal entry.                                                                                                |
| Idempotency Key    | A stable key that makes retries safe by ensuring the same posting request cannot create duplicate journal entries.                                                        |
| Audit Log          | An immutable record of who attempted, approved, posted, voided, or failed an accounting action.                                                                           |
| Inventory Movement | A tenant-scoped stock quantity change tied to a posted transaction or explicit adjustment.                                                                                |
| Accounting Period  | A tenant-scoped date range that can be open or closed. Closed periods block posting, editing, and voiding unless a privileged reopening workflow exists.                  |

## Future Prisma Model Design

These are design recommendations only. Do not treat this section as implemented schema.

```prisma
model Account {
  id         String      @id @default(uuid())
  businessId String
  code       String
  name       String
  type       AccountType
  parentId   String?
  isSystem   Boolean     @default(false)
  isActive   Boolean     @default(true)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  deletedAt  DateTime?

  business   Business    @relation(fields: [businessId], references: [id])
  parent     Account?    @relation("AccountParent", fields: [parentId], references: [id])
  children   Account[]   @relation("AccountParent")

  @@unique([businessId, code])
  @@index([businessId])
  @@index([businessId, type])
  @@index([businessId, deletedAt])
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

model JournalEntry {
  id                  String             @id @default(uuid())
  businessId          String
  sourceTransactionId String?
  postingDate         DateTime
  description         String
  status              JournalEntryStatus
  idempotencyKey      String
  createdById         String
  postedAt            DateTime?
  voidedAt            DateTime?
  voidedById          String?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  lines               JournalLine[]

  @@unique([businessId, idempotencyKey])
  @@index([businessId])
  @@index([sourceTransactionId])
  @@index([businessId, status])
}

model JournalLine {
  id             String   @id @default(uuid())
  journalEntryId String
  accountId      String
  debitAmount    Decimal  @default(0) @db.Decimal(12, 2)
  creditAmount   Decimal  @default(0) @db.Decimal(12, 2)
  description    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id])
  account        Account      @relation(fields: [accountId], references: [id])

  @@index([journalEntryId])
  @@index([accountId])
}

model InventoryMovement {
  id                  String                @id @default(uuid())
  businessId          String
  productId           String
  sourceTransactionId String?
  type                InventoryMovementType
  quantityChange      Decimal               @db.Decimal(14, 3)
  unitCost            Decimal?              @db.Decimal(12, 2)
  createdById         String
  createdAt           DateTime              @default(now())

  @@index([businessId])
  @@index([productId])
  @@index([sourceTransactionId])
}

model AuditLog {
  id         String   @id @default(uuid())
  businessId String
  userId     String
  action     String
  entityType String
  entityId   String
  metadata   Json
  createdAt  DateTime @default(now())

  @@index([businessId])
  @@index([userId])
  @@index([entityType, entityId])
}
```

Likely supporting enums:

- `JournalEntryStatus`: `DRAFT`, `PENDING`, `POSTED`, `VOIDED`, `REVERSED`.
- `InventoryMovementType`: `SALE`, `PURCHASE`, `ADJUSTMENT`, `REVERSAL`.

## Posting Rules

Exact account mapping will require tenant configuration and default system accounts. The initial rules should be explicit and testable.

| Transaction Type   | Future Posting Behavior                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `SALE`             | Debit Cash or Accounts Receivable. Credit Sales Revenue. If inventory cost exists, credit Inventory Asset and debit Cost of Goods Sold. |
| `EXPENSE`          | Debit the mapped Expense Account. Credit Cash or Accounts Payable.                                                                      |
| `PURCHASE`         | Debit Inventory Asset or Expense depending on item/account mapping. Credit Cash or Accounts Payable.                                    |
| `CUSTOMER_PAYMENT` | Debit Cash. Credit Accounts Receivable.                                                                                                 |
| `SUPPLIER_PAYMENT` | Debit Accounts Payable. Credit Cash.                                                                                                    |
| `ADJUSTMENT`       | Requires explicit account mapping, reason, and confirmation before posting.                                                             |

Mapping decisions that must not be guessed silently:

- Cash account versus bank account.
- Receivable versus immediate cash sale.
- Payable versus immediate cash purchase.
- Product revenue account.
- Product inventory asset account.
- Product cost of goods sold account.
- Expense category account.
- Currency and exchange-rate handling.

## Posting Lifecycle

Transaction states:

- `DRAFT`: Intent can be edited and is not ledger truth.
- `POSTED`: Intent has passed posting validation and should have a corresponding posted journal entry once the engine exists.
- `VOIDED`: Intent has been voided and should have reversal artifacts once posting exists.

Future journal entry states:

- `DRAFT` or `PENDING`: Journal preview exists but is not ledger truth.
- `POSTED`: Balanced journal lines are persisted and reports may read them.
- `VOIDED` or `REVERSED`: A reversal exists or the entry is marked as reversed through an auditable workflow.

Lifecycle:

1. Create transaction intent.
2. Validate required fields for the transaction type.
3. Verify active membership and required permission.
4. Verify source transaction belongs to active business.
5. Resolve account mappings.
6. Build journal entry draft.
7. Verify debits equal credits.
8. Verify related customer, supplier, product, and account references belong to the same business.
9. Verify inventory impact if applicable.
10. Verify accounting period is open.
11. Persist journal entry and journal lines atomically.
12. Persist inventory movements atomically when applicable.
13. Mark source transaction `POSTED`.
14. Write audit log.
15. Return a response that distinguishes posted ledger result from draft intent.

## Idempotency Rules

- Posting the same transaction twice must never create duplicate journal entries.
- Every posting attempt must include an idempotency key.
- The unique constraint should be tenant-scoped, such as `@@unique([businessId, idempotencyKey])`.
- If a retry uses the same idempotency key after a successful post, the service should return the existing result.
- If a retry uses the same key while the first attempt is in progress, the service should reject with a safe in-progress response or wait according to the chosen job model.
- AI tool calls must pass idempotency keys derived from stable message/tool-call identifiers.
- Network retries must be safe for both human-driven API calls and AI tool execution.
- Idempotency records should include request hash or source transaction id to detect accidental key reuse for different payloads.

## Void / Reversal Rules

- Posted transactions should not be hard-deleted.
- Posted journal lines should not be edited directly except status metadata.
- Voiding a posted transaction should create reversal journal entries.
- Reversal lines should mirror the original entry with debits and credits swapped.
- Voiding inventory-affecting transactions should create reversing inventory movements.
- Voiding must require explicit permission.
- Voiding should require a reason.
- Voiding must be audited with user, business, source transaction, original journal entry, reversal entry, and timestamp.
- Voiding a draft transaction may be allowed as a simple status change, but posted transaction voiding must use reversal logic.
- Reports should preserve both original and reversal entries so historical audit trails remain explainable.

## Inventory Boundary

Inventory automation belongs behind posting rules, not behind raw transaction-intent creation.

Future inventory behavior:

- Sale posting reduces quantity for stock-tracked products.
- Purchase posting increases quantity for stock-tracked products.
- Adjustment posting changes quantity only with explicit reason and permission.
- Inventory movement rows must include `businessId`.
- Inventory movement rows must reference the source transaction when one exists.
- Product references must belong to the active business.
- No inventory movement should occur without posting validation.
- Negative inventory should be blocked or require a business policy and explicit confirmation.
- Voiding inventory-affecting transactions creates reversing movements rather than directly editing historical movements.

## Tenant Isolation Rules

- Every accounting engine table must include `businessId` or inherit it through a parent that is always joined and verified.
- Every posting query must filter by `businessId`.
- Source transaction, customer, supplier, product, account, journal entry, journal line, inventory movement, and audit log must belong to the same business.
- Account mappings must be tenant-scoped.
- Idempotency keys must be tenant-scoped.
- Reports must read only ledger data for the requested business.
- AI tools must never post across businesses.
- Authorization must check membership and permission before loading or mutating tenant accounting data.
- Denial responses must not reveal whether another business's entity exists.

## Permission Rules

Future accounting engine permissions:

- `transactions.create`
- `transactions.update`
- `transactions.post`
- `transactions.void`
- `accounts.manage`
- `reports.view`
- `inventory.adjust`
- `ai.tools.execute`

Suggested role mapping:

| Role       | Suggested Permissions                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OWNER      | Full accounting engine permissions.                                                                                                  |
| ADMIN      | Full accounting engine permissions except future billing-only or ownership-only actions.                                             |
| ACCOUNTANT | Post and void transactions, manage accounts if the product allows accountant control, view reports, and execute accounting AI tools. |
| STAFF      | Create draft transactions and possibly submit for review. No post or void permission if the product adopts approval workflows.       |
| VIEWER     | Read-only access only.                                                                                                               |

Permission implementation should remain explicit. Do not infer posting permission from read permission or from broad authentication alone.

## AI Tool Boundary

Future AI actions may prepare:

- Sale draft.
- Expense draft.
- Purchase draft.
- Customer payment draft.
- Supplier payment draft.
- Inventory adjustment draft.

AI must not silently post without:

- `activeBusinessId`.
- Active membership check.
- Permission check.
- Required fields.
- Same-business validation for every referenced entity.
- Balanced journal preview.
- User confirmation for risky actions.
- Idempotency key.
- Audit log.

AI response wording must distinguish:

- Draft prepared.
- Posting pending confirmation.
- Posted successfully.
- Failed validation.
- Voided or reversed.

The AI should never say "posted", "recorded in the ledger", or "inventory updated" unless the backend accounting engine confirms that the posting and related movements succeeded.

## Validation Rules

Required validation before posting:

- User has active business membership.
- User has posting permission.
- Source transaction belongs to business.
- Source transaction status allows posting.
- Transaction type is supported by the posting engine.
- Required fields for the transaction type exist.
- Line totals match transaction total.
- Accounts exist and belong to the same business.
- Account mappings are complete.
- Debits equal credits.
- Customer, supplier, and product references belong to the same business.
- Inventory quantity rules pass when applicable.
- Currency is consistent with business settings or a supported multi-currency policy.
- Accounting period is open.
- Idempotency key is present and safe to use.

## Error Handling

Safe accounting engine errors:

| Error                         | Meaning                                                                 | Safe Handling                                                           |
| ----------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Validation error              | Required fields, totals, or references are invalid.                     | Return specific fixable field errors without leaking cross-tenant data. |
| Permission denied             | User lacks required permission.                                         | Return forbidden response and do not disclose sensitive details.        |
| Closed accounting period      | Posting date is in a closed period.                                     | Block posting and explain the period is closed.                         |
| Unbalanced journal entry      | Debits and credits do not match.                                        | Reject posting and preserve transaction draft.                          |
| Missing account mapping       | System cannot map transaction to accounts.                              | Ask for configuration or manual account selection.                      |
| Insufficient inventory        | Stock policy blocks the sale or adjustment.                             | Reject or require confirmation according to business policy.            |
| Duplicate posting attempt     | Idempotency key or source transaction already posted.                   | Return existing result or safe duplicate response.                      |
| Stale transaction status      | Transaction changed between preview and post.                           | Reject and require refresh/review.                                      |
| Cross-tenant reference denied | Entity belongs to another business or cannot be found in this business. | Return not found or forbidden without confirming external existence.    |

## Implementation Phases

### Phase 1: Chart of Accounts Foundation

- Add chart of accounts schema.
- Add default system accounts per business.
- Add account APIs.
- Add account mapping configuration for transaction types and product categories.
- Add tests for tenant-scoped account access and account-code uniqueness.

### Phase 2: Posting Engine

- Add `JournalEntry` and `JournalLine` schema.
- Add posting service.
- Implement sale, expense, and purchase posting.
- Enforce idempotency.
- Verify balanced debits and credits.
- Keep reports blocked from transaction-intent data until ledger data exists.

### Phase 3: Reversals, Inventory, Periods, and Audit

- Add void/reversal support.
- Add inventory movement support.
- Add accounting period support.
- Add audit logs.
- Add tests for reversal integrity and closed-period blocking.

### Phase 4: AI, Reports, and Exports

- Integrate AI tool execution with posting permissions, confirmation, idempotency, and audit logs.
- Add reports that read only posted ledger data.
- Add PDF exports based on report outputs.

## Acceptance Criteria for Future Implementation

Future accounting engine implementation is acceptable only when:

- Every posted transaction creates balanced journal entries.
- Posting is idempotent.
- Posting and source transaction status updates happen atomically.
- Voiding creates reversal entries.
- Inventory-affecting voids create reversal inventory movements.
- No cross-tenant account, customer, supplier, product, transaction, journal, or inventory references are allowed.
- No transaction posts without permission.
- AI cannot post without confirmation and idempotency.
- Reports read only posted ledger data.
- Audit logs exist for post, void, reversal, failed validation, and denied permission attempts.
- Closed accounting periods block posting and voiding unless explicitly reopened by an authorized workflow.
