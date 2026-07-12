# Reversal And Void Design

## Purpose

SmartAccountant / Finance AI now has tenant-scoped transaction intents, chart of accounts, journal storage, posting preview, and idempotent atomic posting for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, `SUPPLIER_PAYMENT`, and stored-line `ADJUSTMENT`.

The next accounting safety boundary is cancellation and correction. This document defines the future workflow for draft cancellation, posted transaction reversal, posted journal handling, and later inventory-affecting reversals.

This is architecture only. It does not modify Prisma schema, create migrations, implement endpoints, implement reversal logic, change `Transaction.status` behavior, edit or delete posted `JournalLine` records, add inventory movements, add sale COGS posting, add audit logs, add accounting periods, add approvals, add AI orchestration, persist chat, generate reports, export PDFs, build dashboards, or add mobile reversal UI.

Core rule:

> Posted ledger records are immutable. A posted transaction is corrected by creating a reversing journal entry, not by deleting or editing the original journal lines.

## Terminology

### Draft Cancellation

Draft cancellation applies only to a `DRAFT` transaction intent.

Rules:

- It may update the transaction status from `DRAFT` to `VOIDED`.
- It does not create a reversal journal because no posted ledger entry exists.
- It must not affect a posted journal.
- It may continue to use `transactions.void` if the transaction is still `DRAFT`.
- It should require a reason once `voidReason`, `voidedAt`, and `voidedById` exist.

### Posted Reversal

Posted reversal applies to a `POSTED` transaction with exactly one matching POSTED `JournalEntry`.

Rules:

- It creates a new POSTED reversing `JournalEntry`.
- It copies every original `JournalLine` with debit and credit swapped.
- It does not edit or delete the original `JournalLine` records.
- It marks the original `JournalEntry` as `REVERSED` only after the reversal entry and lines are created successfully.
- It updates the source `Transaction` to `VOIDED` only after the reversal succeeds.
- It commits all changes atomically.

### Journal Void

`VOIDED` and `REVERSED` must mean different things for journal entries.

Recommended rule:

- `DRAFT` or `PENDING` `JournalEntry` records may become `VOIDED` when abandoned before posting.
- `POSTED` `JournalEntry` records must become `REVERSED` through a reversing journal entry.
- A POSTED `JournalEntry` must never simply become `VOIDED` without a reversal.

## Current State

Implemented today:

- `Transaction` has `DRAFT`, `POSTED`, and `VOIDED` statuses.
- `JournalEntry` has `DRAFT`, `PENDING`, `POSTED`, `VOIDED`, and `REVERSED` statuses.
- `JournalEntry` stores tenant-scoped posting metadata and has unique `(businessId, idempotencyKey)`.
- `JournalLine` stores immutable debit and credit ledger lines for a journal entry.
- Posting creates a POSTED `JournalEntry`, creates balanced `JournalLine` records, and atomically updates the source `Transaction` to `POSTED`.
- Posting supports all six current transaction types: `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, `SUPPLIER_PAYMENT`, and stored-line `ADJUSTMENT`.
- Posting retries are tenant-scoped and idempotent by `businessId + idempotencyKey`.
- Journal draft creation exists for balanced manual draft or pending entries.
- Journal read endpoints exist.
- The early accounting foundation includes `POST /businesses/:businessId/transactions/:transactionId/void`.

Unsafe current behavior:

- The current generic transaction void endpoint directly updates any active transaction to `VOIDED`.
- That behavior is acceptable only for DRAFT cancellation.
- It is unsafe for a ledger-backed POSTED transaction because it can mark the source transaction `VOIDED` without creating a reversing journal and without marking the original journal `REVERSED`.

Required future correction:

- The generic void endpoint must reject POSTED ledger-backed transactions.
- POSTED transactions must use the future reversal workflow.
- Historical `Transaction.status = POSTED` records without a matching posted journal must fail safely and require reconciliation.

## Immutability Rules

Posted ledger evidence must be append-only.

Rules:

- Posted `JournalLine` records cannot be edited.
- Posted `JournalLine` records cannot be deleted.
- Original debit and credit amounts remain unchanged.
- Original posting date remains unchanged.
- Original creator, timestamps, and idempotency key remain unchanged.
- Corrections create new ledger records.
- Both original and reversal entries remain visible for audit and reporting.
- A reversal cannot silently rewrite history.
- Reports must be able to show gross original activity, reversal activity, and net effect.

## Future Data Model Design

The current schema can store a reversal journal as a normal POSTED `JournalEntry`, but it cannot safely link original and reversal journals or prevent duplicate reversals.

Current useful fields:

- `JournalEntry.businessId`
- `JournalEntry.sourceTransactionId`
- `JournalEntry.status`
- `JournalEntry.idempotencyKey`
- `JournalEntry.postedAt`
- `JournalEntry.voidedAt`
- `JournalEntry.voidedById`
- `Transaction.status`

Missing safe reversal links:

- No direct original-to-reversal relation.
- No unique constraint preventing more than one reversal for the same original journal.
- No persisted reversal reason.
- No transaction-level void metadata.
- No request hash for idempotency payload comparison.

Recommended future `JournalEntry` fields:

```prisma
reversesJournalEntryId   String?
reversedByJournalEntryId String?
reversalReason           String?
reversedAt               DateTime?
reversedById             String?
```

Recommended future `Transaction` fields:

```prisma
voidReason String?
voidedAt   DateTime?
voidedById String?
```

Recommended relationship:

Original `JournalEntry`:

- `status = REVERSED`
- `reversedByJournalEntryId = reversalEntry.id`
- `reversedAt = now`
- `reversedById = userId`
- Original lines stay unchanged.

Reversal `JournalEntry`:

- `status = POSTED`
- `reversesJournalEntryId = originalEntry.id`
- `sourceTransactionId = originalTransaction.id`
- `description` identifies it as a reversal.
- Lines mirror original lines with debit and credit swapped.

Recommended uniqueness rules:

- `reversedByJournalEntryId` is unique when present.
- `reversesJournalEntryId` is unique when present.
- A reversal entry can reference only one original journal.
- An original journal can have at most one successful reversal journal.
- A reversal entry must not itself be reversed in the first implementation phase.
- Reversal of a reversal requires a separately approved workflow.

Recommended model choice:

- Add explicit nullable self-relations on `JournalEntry`.
- Store reversal metadata on both the original and reversal entries.
- Store transaction void metadata on `Transaction`.
- Continue using `(businessId, idempotencyKey)` for the reversal action, then add request-hash storage later for stronger payload comparison.

Why:

- The ledger relationship is queryable without parsing descriptions.
- Duplicate reversal prevention can be enforced by database uniqueness.
- Reports can show original and reversal pairs clearly.
- The source transaction can remain linked to both original and reversal journals.
- It preserves immutable lines and creates a durable audit path even before a dedicated `AuditLog` table exists.

## Future Reversal Service Contract

Recommended method:

```ts
reverseTransaction({
  businessId,
  transactionId,
  userId,
  reason,
  idempotencyKey,
  reversalDate,
  source,
}: {
  businessId: string;
  transactionId: string;
  userId: string;
  reason: string;
  idempotencyKey: string;
  reversalDate?: string;
  source: 'MANUAL' | 'SYSTEM_RETRY' | 'IMPORT';
}): Promise<ReverseTransactionResult>
```

Recommended response:

```ts
interface ReverseTransactionResult {
  businessId: string;
  transactionId: string;
  originalJournalEntryId: string;
  reversalJournalEntryId: string;
  transactionStatus: 'VOIDED';
  originalJournalStatus: 'REVERSED';
  reversalJournalStatus: 'POSTED';
  totalDebit: string;
  totalCredit: string;
  reversedAt: string;
  reason: string;
  idempotencyKey: string;
  warnings: string[];
}
```

Supported sources should initially remain:

- `MANUAL`
- `SYSTEM_RETRY`
- `IMPORT`

Do not add `AI_TOOL` as a reversal source until AI confirmation, audit, and tool authorization are implemented.

## Future Endpoint Design

Design only:

```http
POST /businesses/:businessId/transactions/:transactionId/reversal-preview
POST /businesses/:businessId/transactions/:transactionId/reverse
```

Optional journal-level endpoint:

```http
POST /businesses/:businessId/journal-entries/:journalEntryId/void
```

Endpoint rules:

- Transaction reversal is the primary workflow for source-linked posted journals.
- Source-linked posted journal reversal must not bypass the transaction workflow.
- Direct journal voiding should initially apply only to `DRAFT` or `PENDING` manual journals that were never posted.
- Direct journal-level reversal of a POSTED source-linked journal should remain blocked until a separately approved advanced workflow exists.
- The existing transaction void route may remain for DRAFT cancellation only.

## Reversal Preview

Reversal preview is non-persisted.

Required behavior:

1. Authenticate the user.
2. Verify ACTIVE business membership.
3. Verify `reversals.preview`.
4. Load the transaction by `businessId` and `transactionId`.
5. Require `Transaction.status = POSTED`.
6. Load exactly one matching POSTED original `JournalEntry`.
7. Reject missing, multiple, or inconsistent ledger state.
8. Reject an already reversed journal.
9. Verify the journal belongs to the same business.
10. Verify original journal lines are balanced.
11. Swap every original line's debit and credit.
12. Return balanced preview lines and totals.
13. Return warnings.
14. Create no `JournalEntry`.
15. Create no `JournalLine`.
16. Update no status.

Example:

Original:

- Cash debit `100.00`
- Sales Revenue credit `100.00`

Reversal preview:

- Cash credit `100.00`
- Sales Revenue debit `100.00`

Recommended preview response:

```ts
interface ReversalPreviewResponse {
  businessId: string;
  transactionId: string;
  originalJournalEntryId: string;
  transactionType: string;
  reversalDate: string;
  lines: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    debitAmount: string;
    creditAmount: string;
    description?: string;
  }>;
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
  warnings: string[];
  errors: Array<{ code: string; message: string; field?: string }>;
}
```

## Reversal Posting

Future reversal posting must:

1. Authenticate the user.
2. Verify ACTIVE membership.
3. Verify `reversals.create`.
4. Load the transaction by `businessId`.
5. Require `Transaction.status = POSTED`.
6. Load exactly one matching POSTED original `JournalEntry`.
7. Verify the journal belongs to the same business.
8. Verify the journal is not already reversed.
9. Require a non-blank reason.
10. Require an idempotency key.
11. Build swapped journal lines.
12. Validate accounts remain same-business.
13. Validate reversal totals balance.
14. Create a new POSTED reversal `JournalEntry`.
15. Create swapped `JournalLine` records.
16. Mark the original `JournalEntry` `REVERSED`.
17. Update the source `Transaction` to `VOIDED`.
18. Commit all changes atomically.

If any step fails:

- No reversal journal remains.
- No reversal lines remain.
- Original journal remains POSTED.
- Transaction remains POSTED.
- No inventory movement, audit log, AI action, report output, PDF, dashboard update, or chat persistence side effect is created.

## Idempotency

Reversal requires a stable idempotency key.

Rules:

- Same `businessId + idempotencyKey + original transaction` returns the same reversal result.
- The same key used for a different transaction is rejected.
- A second key cannot create a second reversal for the same original journal.
- Concurrent reversal attempts must create at most one reversal.
- The original-journal to reversal-journal relation must be unique.
- Unique reversal links are required even if the idempotency table or idempotency key path fails.
- Request-hash storage remains a future hardening task because the current schema does not persist payload hashes.

Recommended conflict behavior:

- Existing key and same original transaction: return existing reversal response.
- Existing key and different transaction: reject with `DUPLICATE_IDEMPOTENCY_KEY`.
- New key but original already reversed: reject with `JOURNAL_ALREADY_REVERSED` and include the existing reversal reference if safe for the same business.
- Concurrent attempts: one transaction wins; the loser reloads and returns the existing reversal or rejects with a safe conflict.

## Permissions

Recommended dedicated permissions:

- `reversals.preview`
- `reversals.create`

Recommended roles:

| Role       | Preview | Create |
| ---------- | ------- | ------ |
| OWNER      | Yes     | Yes    |
| ADMIN      | Yes     | Yes    |
| ACCOUNTANT | Yes     | Yes    |
| STAFF      | No      | No     |
| VIEWER     | No      | No     |

Draft cancellation:

- `transactions.void` may remain sufficient for DRAFT transaction cancellation.
- `reversals.create` is required for POSTED transaction reversal.
- `journalEntries.void` may be used only for DRAFT/PENDING manual journal voiding.

No permission bypasses ACTIVE business membership.

## Status Transitions

### Transaction

Allowed:

- `DRAFT -> VOIDED` through draft cancellation.
- `DRAFT -> POSTED` through approved posting.
- `POSTED -> VOIDED` only after successful reversal.

Not allowed:

- `VOIDED -> POSTED`.
- `POSTED -> DRAFT`.
- `POSTED -> VOIDED` through a simple status update.
- `VOIDED -> DRAFT` unless a future restore workflow is separately approved.

### JournalEntry

Allowed:

- `DRAFT -> VOIDED` for abandoned manual draft.
- `PENDING -> VOIDED` if never posted.
- `DRAFT/PENDING -> POSTED` through approved posting or approval workflow.
- `POSTED -> REVERSED` only after successful reversal journal creation.

Not allowed:

- `REVERSED -> POSTED`.
- `POSTED -> VOIDED` without reversal.
- Editing or deleting posted lines during any status transition.

### Reversal JournalEntry

Rules:

- Created directly as `POSTED` inside the atomic reversal transaction.
- References the original journal through `reversesJournalEntryId`.
- Uses the original transaction as `sourceTransactionId`.
- Must not itself be reversible in the first implementation phase.

## Safety Gates

Required gates:

- Authenticated user.
- ACTIVE business membership.
- Reversal permission.
- Same-business transaction.
- Transaction is `POSTED`.
- Exactly one matching original POSTED journal exists.
- Journal belongs to same business.
- Journal has balanced lines.
- Journal is not already reversed.
- Reason is required.
- Reversal date is valid.
- Idempotency key is required.
- Accounting period is open once periods exist.
- Account references remain valid for the same business.
- Future inventory reversal is available when inventory effects exist.

## Current Transaction Types

### SALE

- Reverse financial journal lines by swapping debit and credit.
- Current implementation has no inventory or COGS side effect.
- When inventory and COGS posting exist later, reversal must also restore inventory and COGS effects atomically.

### EXPENSE

- Reverse financial journal lines by swapping debit and credit.

### PURCHASE

- Reverse financial journal lines by swapping debit and credit.
- Current implementation has no quantity movement.
- Future inventory movement reversal must be atomic with financial reversal.

### CUSTOMER_PAYMENT

- Reverse Cash / Accounts Receivable lines.
- Invoice allocation reversal remains future work.

### SUPPLIER_PAYMENT

- Reverse Accounts Payable / Cash lines.
- Invoice allocation reversal remains future work.

### ADJUSTMENT

- Reverse every posted journal line by swapping debit and credit.
- Original stored adjustment intent lines remain unchanged.
- The reversal journal provides the ledger correction; it does not rewrite the original adjustment intent.

## Inventory Boundary

Current posting does not create inventory movements.

Rules:

- Current financial-only postings can be reversed financially.
- Once inventory movement automation exists, reversal of inventory-affecting transactions must reverse both journal and inventory movements atomically.
- The system must not financially reverse an inventory posting while leaving stock movements unchanged.
- Future reversal implementation should block inventory-linked reversal until inventory reversal support exists.
- No inventory behavior is implemented by this design task.

## Accounting Period Boundary

Accounting periods do not exist yet.

Future behavior:

- Reversal date must belong to an open period.
- Reversal should normally be dated in the current open period.
- Original posting date must not be rewritten.
- Closed-period reversal requires a separate privileged policy.
- If the original posting period is closed, the reversal should be posted into the current open period unless policy requires reopening.
- No accounting period behavior is implemented by this design task.

## Audit Boundary

Audit logs do not exist yet.

Future required audit events:

- Reversal preview requested.
- Reversal attempted.
- Reversal succeeded.
- Reversal failed.

Required audit metadata:

- Original journal ID.
- Reversal journal ID when created.
- Transaction ID.
- Business ID.
- User ID.
- Reason.
- Timestamp.
- Idempotency key.
- Safe failure metadata.

Architecture decision:

- Audit storage is required before production release of reversal workflows.
- A narrowly scoped development reversal phase may proceed before a full `AuditLog` table only if all ledger links, immutable timestamps, reversal reason, idempotency key, and user metadata are persisted on `Transaction` and `JournalEntry`.

## Safe Errors

Errors must not reveal whether another business owns an ID.

Recommended safe error codes:

| Code                                | Meaning                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `TRANSACTION_NOT_FOUND`             | Transaction does not exist in this business or is unavailable.               |
| `PERMISSION_DENIED`                 | User lacks active membership or required reversal permission.                |
| `TRANSACTION_NOT_POSTED`            | Transaction is not currently POSTED.                                         |
| `POSTED_TRANSACTION_HAS_NO_JOURNAL` | Source transaction is POSTED but has no matching posted journal.             |
| `MULTIPLE_POSTED_JOURNALS`          | More than one matching posted journal exists and reconciliation is required. |
| `ORIGINAL_JOURNAL_NOT_POSTED`       | Matching journal is not POSTED.                                              |
| `JOURNAL_ALREADY_REVERSED`          | Original posted journal already has a reversal.                              |
| `MISSING_REASON`                    | Reversal reason is required.                                                 |
| `MISSING_IDEMPOTENCY_KEY`           | Idempotency key is required.                                                 |
| `DUPLICATE_IDEMPOTENCY_KEY`         | Key is already used for another operation.                                   |
| `UNBALANCED_ORIGINAL_JOURNAL`       | Original journal lines are not balanced and require reconciliation.          |
| `INACTIVE_ACCOUNT`                  | Referenced account is inactive, deleted, or unavailable.                     |
| `CONCURRENT_REVERSAL_CONFLICT`      | Another reversal attempt completed or is in progress.                        |
| `CLOSED_ACCOUNTING_PERIOD`          | Reversal date is not allowed because the period is closed.                   |
| `INVENTORY_REVERSAL_UNAVAILABLE`    | Inventory-linked reversal is blocked until inventory reversal exists.        |

Cross-tenant and missing resource messages should be generic, such as "Transaction not found for this business."

## AI Boundary

AI may eventually:

- Explain why a reversal may be needed.
- Prepare a reversal preview request.
- Show the exact reversing lines.
- Request explicit user confirmation.

AI must not:

- Reverse silently.
- Invent a reversal reason.
- Bypass permissions.
- Bypass `activeBusinessId`.
- Reverse without idempotency.
- Claim success before backend confirmation.
- Directly edit original journal lines.
- Use reversal to hide accounting errors.
- Execute reversal from stale business context after logout, membership removal, or business switch.

AI-originated reversal must wait for:

- Dedicated AI tool contract update.
- Explicit user confirmation.
- Stable tool-call idempotency.
- Audit infrastructure or approved development substitute.

## Future Testing Plan

Required tests before reversal implementation approval:

1. DRAFT transaction can be cancelled without journal creation.
2. POSTED transaction cannot use simple draft-void path.
3. Valid reversal preview swaps debit and credit.
4. Preview remains non-persisted.
5. Valid reversal creates one reversing `JournalEntry`.
6. Reversal lines mirror original lines with swapped sides.
7. Reversal totals remain balanced.
8. Original journal becomes `REVERSED`.
9. Reversal journal remains `POSTED`.
10. Source transaction becomes `VOIDED`.
11. Original lines remain unchanged.
12. Same idempotency key returns same reversal.
13. Different key cannot reverse an already reversed journal.
14. Concurrent reversal creates one result only.
15. Cross-tenant access denied.
16. VIEWER denied.
17. STAFF denied.
18. ACCOUNTANT allowed.
19. Missing reason rejected.
20. Missing original journal requires reconciliation.
21. Historical inconsistent records fail safely.
22. Forced failure rolls back every status and journal write.
23. SALE reversal works.
24. EXPENSE reversal works.
25. PURCHASE reversal works.
26. CUSTOMER_PAYMENT reversal works.
27. SUPPLIER_PAYMENT reversal works.
28. ADJUSTMENT reversal works.
29. No inventory movement behavior is added.
30. No original journal lines are edited or deleted.

## Implementation Phases

### Phase 1: Reversal / Void Design

- Create this document.
- Update project-management status, tasks, and changelog.
- Do not implement schema, APIs, services, status changes, inventory, audit, AI, reports, PDFs, dashboards, or mobile UI.

### Phase 2: Schema Links And Reversal Preview

- Add future reversal relation fields on `JournalEntry`.
- Add future void metadata fields on `Transaction`.
- Add `reversals.preview` and `reversals.create`.
- Add non-persisted reversal preview.
- Keep posting behavior unchanged.

### Phase 3: Atomic Financial Reversal

- Implement `reverseTransaction`.
- Support all current financial transaction types.
- Create reversing journal and swapped lines atomically.
- Mark original journal `REVERSED`.
- Mark source transaction `VOIDED`.
- Block the generic POSTED transaction void path.

### Phase 4: Audit Log And Accounting Periods

- Add audit events for reversal lifecycle.
- Add period-open validation.
- Add closed-period policy for reversal dates.

### Phase 5: Inventory Movement Reversal

- Implement inventory movement reversal only after inventory posting exists.
- Ensure stock and ledger reversal are atomic.
- Block inventory-linked reversal while support is incomplete.

### Phase 6: AI-Assisted Reversal

- Add AI tool contract for reversal preview and confirmation.
- Require explicit user confirmation.
- Use stable AI idempotency keys.
- Preserve safe wording and audit metadata.

## Acceptance Criteria For Future Implementation

Future implementation is acceptable only when:

- Draft cancellation and posted reversal are separate workflows.
- Posted journal lines remain immutable.
- Reversal preview is non-persisted.
- Reversal posting is atomic.
- Idempotency and concurrency are enforced.
- Permissions are explicit.
- Status transitions are test-covered.
- Inventory-linked reversals are blocked until inventory reversal exists.
- Closed-period reversal rules are enforced once periods exist.
- Audit metadata is persisted before production release.
- AI cannot reverse silently or bypass confirmation.
- Safe errors do not leak cross-tenant ownership.
