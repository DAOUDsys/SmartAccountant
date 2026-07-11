# Adjustment Posting Design

## Purpose

`ADJUSTMENT` posting is high risk because it can move value between any ledger accounts and can be used to correct, reclassify, or initialize financial balances. Unlike sales, expenses, purchases, and payments, an adjustment does not have one safe default account pattern. The system must never guess debit or credit accounts silently.

Every future adjustment must be explicit, explainable, balanced, tenant-scoped, and posted through the same controlled accounting boundary as other posted transaction intents. An adjustment is not ledger truth until the approved posting pathway creates a matching POSTED `JournalEntry` with balanced `JournalLine` records.

Adjustment posting must require:

- Explicit debit and credit account selection.
- A clear business reason.
- At least two valid lines.
- Equal total debits and credits.
- Active, non-deleted accounts owned by the active business.
- The same idempotent and atomic posting behavior used by approved posting types.
- Safe errors that do not reveal whether another business owns a referenced account.

This document is design only. It does not modify Prisma schema, create migrations, implement backend APIs, add posting logic, update `Transaction.status` behavior, implement reversals, automate inventory movement, post sale COGS, add audit logs, add accounting periods, integrate AI orchestration, persist chat, generate reports, export PDFs, build dashboards, add budgets/goals/bank/OCR features, or add mobile posting UI.

## Current State

Implemented foundations:

- Authentication and JWT-protected backend routes.
- Tenant-aware authorization through `Business`, `BusinessMember`, roles, active membership checks, and permission helpers.
- Tenant-scoped `Transaction` and `TransactionLine` intent records.
- Tenant-scoped Chart of Accounts through `Account` and `AccountMapping`.
- Tenant-scoped `JournalEntry` and `JournalLine` ledger storage.
- Journal balancing helpers that reject unbalanced, zero-value, negative, and both-sided lines.
- Posting Preview Builder for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`.
- Posting endpoint `POST /businesses/:businessId/transactions/:transactionId/post`.
- Posting support for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`.
- Tenant-scoped idempotency using `JournalEntry.businessId + JournalEntry.idempotencyKey`.

Current `ADJUSTMENT` behavior:

- Preview is safely rejected with `ADJUSTMENT_REQUIRES_EXPLICIT_ACCOUNTS`.
- Posting is safely rejected because the posting service supported type list excludes `ADJUSTMENT`.
- No `Transaction.status` update is performed for rejected adjustments.
- No journal entry, journal lines, inventory movement, audit log, report output, PDF, AI tool call, or mobile posting UI is created.

Not implemented yet:

- Adjustment account selection.
- Adjustment line storage.
- Adjustment preview.
- Adjustment posting.
- Approval workflow.
- Audit logs.
- Accounting periods.
- Reversals.
- Inventory adjustment movement.
- Sensitive-account confirmation.

## Adjustment Types

Future adjustment categories may include:

- Opening balance adjustment: initial setup balances when onboarding a business.
- Correction adjustment: correcting a prior classification or amount after review.
- Reclassification adjustment: moving value between accounts without changing total equity.
- Owner equity adjustment: owner contributions, draws, or equity setup corrections.
- Write-off adjustment: writing off receivables, payables, or small balances.
- Manual general adjustment: accountant-entered debit/credit adjustment with an explicit reason.
- Inventory quantity adjustment: future only, must go through an inventory movement boundary.
- Foreign exchange adjustment: future only, requires multi-currency and exchange-rate design.

Initial implementation should support only a simple manual financial adjustment with explicit debit and credit account lines. Inventory quantity adjustments and foreign exchange adjustments should remain out of scope until their own domain rules are approved.

## Required Data

Future adjustment preview and posting must require an explicit line payload or previously stored explicit adjustment lines.

Recommended future request shape:

```json
{
  "description": "Correct opening balance",
  "reason": "Opening balance setup",
  "postingDate": "2026-07-11",
  "lines": [
    {
      "accountId": "cash-account-id",
      "debitAmount": "100.00",
      "creditAmount": "0.00",
      "description": "Debit Cash"
    },
    {
      "accountId": "owner-equity-account-id",
      "debitAmount": "0.00",
      "creditAmount": "100.00",
      "description": "Credit Owner Equity"
    }
  ]
}
```

Required rules:

- `description` is required.
- `reason` is required.
- `postingDate` is required for preview and posting, and later must be inside an open accounting period.
- `currency` should be included or inferred from the tenant business only while the app is single-currency.
- Currency must match `Business.currency` until multi-currency is explicitly designed.
- At least two lines are required.
- Every line must reference an `Account`.
- Every account must belong to the route `businessId`.
- Every account must be active.
- Deleted accounts cannot be used.
- A line cannot have both debit and credit amounts greater than zero.
- A line cannot have neither debit nor credit.
- Debit and credit amounts must be non-negative.
- Total debits must equal total credits.
- Total debits must be greater than zero.
- Line descriptions should be optional only after the header description and reason are required.

## Transaction Model Fit

Current `Transaction` and `TransactionLine` models are not enough for adjustment lines.

Current `TransactionLine` fields:

- `productId`
- `description`
- `quantity`
- `unitPrice`
- `totalAmount`

Current `TransactionLine` cannot store `accountId`, `debitAmount`, or `creditAmount`. It is product/quantity/price oriented and fits sales, purchases, expenses, and simple payment intent lines better than ledger adjustment lines.

Do not overload `TransactionLine` for adjustments. Overloading it would force fake quantities and prices into records that are actually debit/credit accounting lines, making validation, reporting, audit, and future UI confusing.

Recommended direction:

- Add a dedicated `TransactionAdjustmentLine` model in a future schema task.
- Keep `Transaction` as the adjustment header intent with `type = ADJUSTMENT`.
- Store explicit adjustment lines as their own tenant-scoped records.
- Build preview and posting from those explicit adjustment lines, not from guessed account mappings.

Alternative options:

- JSON metadata on `Transaction`: not recommended because it weakens relational validation, account foreign keys, queryability, and future audit/reconciliation.
- Lines supplied only in the post request: useful for early preview experiments, but weaker for persistence and audit because the source intent may not store the exact approved lines.

Safest current architecture choice: add `TransactionAdjustmentLine` before implementing adjustment posting.

## Future Prisma / DTO Design

Design only. Do not implement in this task.

Recommended Option A: add `TransactionAdjustmentLine`.

Potential Prisma shape:

```prisma
model TransactionAdjustmentLine {
  id             String      @id @default(uuid())
  businessId     String
  transactionId  String
  accountId      String
  debitAmount    Decimal     @default(0) @db.Decimal(12, 2)
  creditAmount   Decimal     @default(0) @db.Decimal(12, 2)
  description    String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  business        Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  transaction     Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  account         Account     @relation(fields: [accountId], references: [id])

  @@index([businessId])
  @@index([transactionId])
  @@index([accountId])
}
```

Recommended DTOs:

- `CreateAdjustmentTransactionDto`: header fields plus explicit adjustment lines.
- `AdjustmentLineDto`: `accountId`, `debitAmount`, `creditAmount`, optional `description`.
- `AdjustmentPreviewDto`: same explicit line shape if preview is request-body driven.
- `PostTransactionDto`: keep existing idempotency/posting shape; do not add account lines there once adjustment lines are stored.

Option B: JSON metadata on `Transaction`.

Not recommended unless a later prototype proves the relational model is too heavy. JSON makes tenant account validation and future reporting harder.

Option C: accept lines in the post request only.

Useful for preview-only exploration, but not recommended for final posting because the posted journal would not have a durable, reviewable adjustment intent line source before posting.

Recommended option: Option A, dedicated `TransactionAdjustmentLine`, because it preserves relational integrity, explicit account references, same-business validation, auditable source intent, and clean separation from product-oriented `TransactionLine`.

## Preview Behavior

The future adjustment preview should be body-driven because explicit adjustment lines are required.

Recommended endpoint for the first implementation:

```http
POST /businesses/:businessId/transactions/:transactionId/adjustment-preview
```

Alternative:

```http
POST /businesses/:businessId/transactions/:transactionId/posting-preview
```

The current `GET /posting-preview` endpoint is not sufficient for adjustments because adjustment lines cannot be inferred from existing `TransactionLine` records. A future `POST` preview endpoint can accept explicit line input or validate already stored adjustment lines.

Preview must:

- Authenticate the user.
- Verify active business membership.
- Verify `adjustments.preview` or an approved equivalent permission.
- Load transaction by `businessId` and `transactionId`.
- Verify transaction type is `ADJUSTMENT`.
- Verify transaction status is `DRAFT`.
- Validate `description` and `reason`.
- Validate explicit adjustment lines.
- Validate every account by `businessId`.
- Reject inactive or deleted accounts.
- Reject both-sided, empty, negative, zero-total, or unbalanced lines.
- Return non-persisted preview lines and totals.
- Return warnings for sensitive accounts when applicable.
- Not create `JournalEntry`.
- Not create `JournalLine`.
- Not update `Transaction.status`.
- Not create inventory movements or audit logs until those phases are approved.

Preview response should include:

- `businessId`
- `transactionId`
- `transactionType`
- `canPost`
- `postingDate`
- `currency`
- `lines`
- `totalDebit`
- `totalCredit`
- `isBalanced`
- `warnings`
- `errors`

## Posting Behavior

Future adjustment posting should reuse the existing posting endpoint if possible:

```http
POST /businesses/:businessId/transactions/:transactionId/post
```

For `ADJUSTMENT`, posting must:

- Require `idempotencyKey`.
- Require explicit adjustment lines already stored through an approved schema/DTO.
- Re-load the transaction and adjustment lines inside the database transaction.
- Verify transaction belongs to `businessId`.
- Verify transaction type is `ADJUSTMENT`.
- Verify transaction status is still `DRAFT`.
- Validate `description`, `reason`, posting date, currency, accounts, and balanced lines again at posting time.
- Check for an existing posted journal for the source transaction.
- Check `businessId + idempotencyKey`.
- Create a POSTED `JournalEntry`.
- Create `JournalLine` records from the explicit adjustment lines.
- Update `Transaction.status` to `POSTED`.
- Commit all changes in one database transaction.
- Return the same response shape as other posting types.

If any step fails:

- No `JournalEntry` remains.
- No `JournalLine` remains.
- `Transaction.status` remains unchanged.
- No inventory movement, audit log, report, PDF, AI action, or chat persistence side effect is created.

## Account Rules

Adjustment accounts must follow these rules:

- Every account must belong to the same `businessId`.
- Every account must be active.
- Deleted accounts cannot be used.
- System accounts can be used, but the user must choose them deliberately.
- Account type combinations are allowed as long as the entry balances.
- The service must not restrict valid debit/credit combinations solely by account type, because adjustments may legitimately affect assets, liabilities, equity, revenue, or expenses.
- The service should optionally warn when sensitive accounts are used.

Sensitive account warning candidates:

- Owner Equity.
- Accounts Receivable.
- Accounts Payable.
- Inventory Asset.
- Sales Revenue.
- Cost of Goods Sold.
- Any system account.

Sensitive warnings should not block posting by themselves. They should require explicit confirmation once confirmation tokens or approval workflows exist.

## Permissions

Recommended future permissions:

- `adjustments.preview`
- `adjustments.post`

Initial implementation may reuse `postingPreview.read` and `journalEntries.post` to stay aligned with the current posting service, but dedicated permissions are cleaner because adjustments are higher risk than ordinary posting.

Recommended role behavior:

| Role       | Preview | Post |
| ---------- | ------- | ---- |
| OWNER      | Yes     | Yes  |
| ADMIN      | Yes     | Yes  |
| ACCOUNTANT | Yes     | Yes  |
| STAFF      | No      | No   |
| VIEWER     | No      | No   |

No role may bypass active business membership checks.

Future approval workflow:

- Sensitive account adjustments may require a second approval.
- Large-value adjustments may require owner/admin approval.
- AI-originated adjustments must require explicit human confirmation.
- Period-closed adjustments must be blocked until accounting periods and reopening workflows exist.

## Safety Gates

Required gates for future preview:

1. Valid authenticated user.
2. Active business membership.
3. Adjustment preview permission.
4. Transaction loaded by `businessId` and `transactionId`.
5. Transaction type is `ADJUSTMENT`.
6. Transaction status is `DRAFT`.
7. Description exists.
8. Reason exists.
9. Explicit lines exist.
10. Every account belongs to `businessId`.
11. Every account is active and not deleted.
12. Lines are non-negative, one-sided, non-empty, and balanced.
13. Total debit is greater than zero.
14. Currency matches business currency until multi-currency is designed.
15. Sensitive account warnings are returned.

Required gates for future posting:

1. Valid authenticated user.
2. Active business membership.
3. Adjustment post permission or `journalEntries.post`.
4. Transaction loaded by `businessId` and `transactionId` inside the database transaction.
5. Transaction type is `ADJUSTMENT`.
6. Transaction status is still `DRAFT`.
7. No existing posted journal for the source transaction.
8. Idempotency key exists.
9. Idempotency key is unused or belongs to the same source transaction.
10. Stored explicit adjustment lines are loaded and revalidated.
11. All account and balance validations pass.
12. Optional sensitive-account confirmation is present once confirmation tokens exist.
13. POSTED journal and lines are created atomically with the transaction status update.

## Error Handling

Safe errors should include:

- `MISSING_REASON`: adjustment reason is required.
- `MISSING_DESCRIPTION`: adjustment description is required.
- `MISSING_ADJUSTMENT_LINES`: at least two explicit lines are required.
- `INVALID_ACCOUNT`: account reference is invalid or unavailable.
- `CROSS_TENANT_ACCOUNT_REFERENCE`: account reference is not available for this business.
- `INACTIVE_ACCOUNT`: account is not active.
- `DELETED_ACCOUNT`: account is not available.
- `UNBALANCED_ADJUSTMENT`: debits and credits must balance.
- `ZERO_VALUE_LINE`: a line must include either debit or credit.
- `BOTH_DEBIT_AND_CREDIT`: a line cannot include both debit and credit.
- `NEGATIVE_AMOUNT`: debit and credit amounts must be non-negative.
- `NON_POSITIVE_TOTAL`: total debit must be greater than zero.
- `TRANSACTION_NOT_DRAFT`: only DRAFT adjustment intents can be posted.
- `PERMISSION_DENIED`: user does not have the required permission.
- `DUPLICATE_IDEMPOTENCY_KEY`: idempotency key is already used for another operation.
- `SENSITIVE_ACCOUNT_CONFIRMATION_REQUIRED`: confirmation is required for sensitive accounts.

Errors must not leak whether another business owns an account ID. Cross-tenant and missing account cases should use the same user-facing wording, such as "Account reference is not available for this business."

## AI Boundary

Future AI may prepare an adjustment draft only if:

- `activeBusinessId` exists.
- The user has adjustment preview permission.
- The user gives a clear reason.
- Accounts are explicitly selected by the user or confirmed from a UI selection.
- A preview is shown before posting.
- The final posting requires explicit confirmation.

AI must not:

- Guess debit or credit accounts silently.
- Post an adjustment without confirmation.
- Claim a ledger change succeeded before the backend returns a posted journal result.
- Use adjustment posting to hide errors or bypass normal sale, expense, purchase, payment, inventory, or reversal workflows.
- Infer or expose cross-tenant accounts.
- Reuse stale active business context.
- Treat a local chat response as persistence.

AI-originated adjustment tool calls should use stable idempotency keys derived from conversation/message/tool-call IDs and should include confirmation metadata once confirmation tokens exist.

## Future Testing Plan

Required future tests:

- Valid two-line adjustment preview succeeds.
- Valid multi-line adjustment preview succeeds.
- Unbalanced adjustment fails.
- Zero-value line fails.
- Line with both debit and credit fails.
- Negative amount fails.
- Missing reason fails.
- Missing description fails.
- Missing adjustment lines fail.
- Cross-tenant account fails safely.
- Inactive account fails.
- Deleted account fails.
- Sensitive account warning is returned.
- VIEWER cannot preview or post adjustment.
- STAFF cannot preview or post adjustment.
- ACCOUNTANT can preview and post adjustment.
- OWNER and ADMIN can preview and post adjustment.
- Posting creates POSTED `JournalEntry`.
- Posting creates balanced `JournalLine` records.
- Posting updates `Transaction.status` atomically after journal creation.
- Journal creation failure leaves `Transaction.status` unchanged.
- Idempotent retry returns the same posted journal.
- Same key for a different transaction is rejected.
- Different key after successful posting does not duplicate journals.
- No product quantity changes.
- No InventoryMovement behavior exists until inventory movement is approved.
- No AuditLog behavior exists until audit logging is approved.
- Existing `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT` posting remains unchanged.

## Implementation Phases

Phase 1: design complete.

- Create this design document.
- Update project-management status, tasks, and changelog.
- Do not implement schema, APIs, posting logic, or UI.

Phase 2: adjustment line storage and preview.

- Add `TransactionAdjustmentLine` or approved equivalent.
- Add DTO validation for explicit adjustment lines.
- Add adjustment preview endpoint.
- Validate accounts, balance, reason, description, status, tenant scope, and permissions.
- Return non-persisted preview lines and warnings.

Phase 3: adjustment posting.

- Extend the existing posting service for `ADJUSTMENT`.
- Reuse the existing posting endpoint where possible.
- Reuse idempotency and atomic journal/status update behavior.
- Revalidate stored adjustment lines inside the posting transaction.
- Keep inventory, audit, AI, reports, PDFs, dashboards, and mobile posting UI out of scope.

Phase 4: approvals, audit, periods, and advanced controls.

- Add approval workflow for sensitive or high-value adjustments.
- Add audit logs.
- Add accounting periods and period-close blocking.
- Add reversal workflow.
- Add inventory adjustment movement only after inventory boundary approval.
- Add AI tool execution only after confirmation and audit infrastructure exist.

## Future Acceptance Criteria

Future implementation is acceptable only if:

- No account guessing is possible.
- Explicit debit and credit account lines are required.
- Every adjustment requires a reason.
- Every adjustment is balanced before preview and before posting.
- Every account is validated against the same business.
- Inactive and deleted accounts are rejected.
- Posting requires an idempotency key.
- Idempotent retry returns the existing matching posted journal.
- Duplicate/conflicting idempotency keys are rejected safely.
- Journal creation, journal lines, and `Transaction.status = POSTED` update are atomic.
- Safe errors do not leak cross-tenant account existence.
- VIEWER and STAFF are denied.
- ACCOUNTANT, ADMIN, and OWNER are allowed according to the approved permission design.
- Tests cover success, validation failures, permission failures, idempotency, and atomicity.
- No inventory movement automation, audit logs, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI are added unless separately approved.
