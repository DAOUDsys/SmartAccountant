# Posting Service Contract

## Purpose

SmartAccountant / Finance AI needs a strict posting service contract before implementation because the current accounting data model intentionally separates transaction intent from ledger truth.

Current `Transaction` and `TransactionLine` records are intent records. They describe what a user, form, import, or future AI tool wants to represent. They are not final double-entry accounting evidence by themselves.

`JournalEntry` and `JournalLine` records are ledger storage. A journal entry becomes trustworthy ledger data only when a controlled posting pathway validates the source intent, resolves accounts, builds balanced lines, persists everything atomically, and records enough metadata for idempotency and future audit.

The future Posting Service is the controlled pathway between transaction intent and ledger truth. Reports must read posted journal entries and journal lines, not raw transaction-intent records. A transaction with `status = POSTED` must not be treated as ledger truth unless a matching posted journal entry exists or a reconciliation/migration has explicitly established that relationship.

This document is architecture only. It does not implement Prisma schema, migrations, backend APIs, posting service logic, transaction status updates, inventory movements, audit logs, AI orchestration, chat persistence, reports, PDF export, dashboards, budgets, goals, bank connections, OCR, or mobile ledger UI.

## Current State

Implemented foundations:

- Authentication with JWT access tokens, hashed refresh tokens, password hashing, and mobile session handling.
- Tenant-aware authorization with `Business`, `BusinessMember`, `BusinessRole`, `BusinessMemberStatus`, membership guards, and permission helpers.
- Tenant-scoped `Customer`, `Supplier`, `Product`, `Transaction`, and `TransactionLine` models.
- Transaction intent statuses: `DRAFT`, `POSTED`, and `VOIDED`.
- Tenant-scoped Chart of Accounts through `Account`, `AccountType`, `NormalBalance`, and soft-delete support.
- Tenant-scoped `AccountMapping` with keys required for future posting.
- Default system accounts and mappings for each new business.
- Tenant-scoped `JournalEntry`, `JournalLine`, and `JournalEntryStatus` storage.
- Journal balancing helpers for debit/credit totals and line validation.
- Same-business active account validation for draft journal lines.
- Guarded journal entry read APIs.
- Draft-only manual journal creation endpoint.

Not implemented yet:

- Posting service.
- Automatic transaction posting.
- Automatic `Transaction.status` updates from posting.
- Inventory movements.
- Audit logs.
- Accounting periods.
- Ledger-backed reports.
- PDF export.
- AI tool execution.
- Chat persistence.

## Posting Service Responsibilities

The future `PostingService` must:

- Authenticate the user through the existing auth layer.
- Verify active business membership for `businessId`.
- Verify the user has posting permission for the business.
- Load the transaction intent by both `businessId` and `transactionId`.
- Validate that the transaction status allows posting.
- Validate transaction header fields, transaction lines, and totals.
- Resolve required account mappings for the transaction type and payment mode.
- Validate customer, supplier, product, account, and mapping references belong to the same business.
- Validate mapped accounts are active, not deleted, and have expected account types where detectable.
- Build a journal entry and journal lines from explicit rules.
- Validate debits equal credits before persistence.
- Enforce idempotency for retries and concurrent attempts.
- Persist journal entry, journal lines, and transaction status update atomically.
- Eventually create inventory movements where applicable after that boundary is approved.
- Eventually write audit log records after audit logging is approved.
- Return a clear result that distinguishes successful ledger posting from draft or preview output.

## Non-Responsibilities

The Posting Service must not:

- Perform AI intent classification.
- Parse natural language.
- Generate reports.
- Export PDFs.
- Manage chat history.
- Silently guess missing account mappings.
- Bypass authentication, business membership checks, or permission checks.
- Post across businesses.
- Read or mutate records by ID without `businessId` scope.
- Mutate historical posted journal lines directly.
- Hide reconciliation problems by marking a transaction posted without journal evidence.
- Perform inventory movements in the first posting implementation unless separately approved.

## Posting Contract

Future service method:

```ts
postTransaction({
  businessId,
  transactionId,
  userId,
  idempotencyKey,
  postingDate,
  confirmationToken,
  source,
}: {
  businessId: string;
  transactionId: string;
  userId: string;
  idempotencyKey: string;
  postingDate: string;
  confirmationToken?: string;
  source: PostingSource;
}): Promise<PostTransactionResult>
```

Posting sources:

```ts
type PostingSource = 'MANUAL' | 'AI_TOOL' | 'SYSTEM_RETRY' | 'IMPORT';
```

Result shape:

```ts
interface PostTransactionResult {
  transactionId: string;
  journalEntryId: string;
  status: 'POSTED';
  totalDebit: string;
  totalCredit: string;
  postedAt: string;
  idempotencyKey: string;
  warnings: string[];
}
```

Contract rules:

- `businessId` is always required and comes from the route or trusted request context.
- `transactionId` identifies a transaction intent inside that business only.
- `userId` identifies the authenticated user and must be checked against active membership.
- `idempotencyKey` is required for every post.
- `postingDate` must be valid and inside an open accounting period once periods exist.
- `confirmationToken` is required for risky or AI-originated actions when product policy requires explicit user confirmation.
- `source` must be stored or included in future audit metadata.

## Safety Gates

Posting must pass these gates in order:

1. Authentication: request has a valid authenticated user.
2. Active business membership: user has ACTIVE membership for `businessId`.
3. Permission check: user has `journalEntries.post` or a future dedicated posting permission.
4. Transaction belongs to business: transaction is loaded with `businessId` and not by ID alone.
5. Transaction status is postable: normally `DRAFT`; `VOIDED` cannot post; existing historical `POSTED` requires reconciliation rather than blind trust.
6. Required fields exist: transaction date, type, currency, total amount, and required party/payment fields for the transaction type.
7. Related records belong to same business: customer, supplier, product, and line references are tenant-scoped.
8. Account mappings exist: required mapping keys resolve for the business.
9. Accounts are active and same-business: mapped and explicit accounts are active, not deleted, and tenant-owned.
10. Lines and totals are valid: quantities, unit prices, total amounts, and header total reconcile.
11. Journal is balanced: total debits equal total credits, each line has one side only, and total debit is positive.
12. Accounting period is open: posting date is within an open period once accounting periods exist.
13. Idempotency key is valid: key is unique for the intended operation or returns the existing matching result.
14. Risky action confirmation exists: AI tool execution, adjustments, destructive actions, or ambiguous mappings require confirmation.

## Transaction Type Posting Rules

### SALE

Cash sale:

- Debit mapped `CASH`.
- Credit mapped `SALES_REVENUE`.

Receivable sale:

- Debit mapped `ACCOUNTS_RECEIVABLE`.
- Credit mapped `SALES_REVENUE`.

Future inventory and cost impact:

- Debit mapped `COST_OF_GOODS_SOLD`.
- Credit mapped `INVENTORY_ASSET`.
- This inventory/COGS behavior is future work and must not be bundled into the first posting implementation unless separately approved.

### EXPENSE

Paid expense:

- Debit expense account, usually mapped `GENERAL_EXPENSE` or a selected expense account.
- Credit mapped `CASH`.

Payable expense:

- Debit expense account.
- Credit mapped `ACCOUNTS_PAYABLE`.

Expense category mapping must not be silently guessed if unclear.

### PURCHASE

Cash purchase of inventory:

- Debit mapped `INVENTORY_ASSET`.
- Credit mapped `CASH`.

Credit purchase of inventory:

- Debit mapped `INVENTORY_ASSET`.
- Credit mapped `ACCOUNTS_PAYABLE`.

Non-inventory purchase:

- Debit selected expense account.
- Credit `CASH` or `ACCOUNTS_PAYABLE`.

Inventory movements remain future work.

### CUSTOMER_PAYMENT

- Debit mapped `CASH`.
- Credit mapped `ACCOUNTS_RECEIVABLE`.

Payment must reference or resolve customer context safely before posting.

### SUPPLIER_PAYMENT

- Debit mapped `ACCOUNTS_PAYABLE`.
- Credit mapped `CASH`.

Payment must reference or resolve supplier context safely before posting.

### ADJUSTMENT

- Requires explicit debit and credit accounts.
- Requires reason and explicit confirmation.
- Must not be inferred from vague user text.
- Must pass the same balancing, tenant, permission, and idempotency gates.

## Account Mapping Rules

Required mapping keys:

- `CASH`
- `ACCOUNTS_RECEIVABLE`
- `ACCOUNTS_PAYABLE`
- `SALES_REVENUE`
- `COST_OF_GOODS_SOLD`
- `INVENTORY_ASSET`
- `GENERAL_EXPENSE`
- `OWNER_EQUITY`

Rules:

- Mapping must belong to the active business.
- Mapped account must belong to the same business.
- Mapped account must be active.
- Mapped account must not be deleted.
- Missing mapping blocks posting.
- Wrong account type blocks posting when detectable. Examples: `CASH` should resolve to an `ASSET`; `ACCOUNTS_PAYABLE` should resolve to a `LIABILITY`; `SALES_REVENUE` should resolve to `REVENUE`; `GENERAL_EXPENSE` and `COST_OF_GOODS_SOLD` should resolve to `EXPENSE`.
- Account mapping lookup must be explicit and test-covered.
- The Posting Service must not silently fall back to arbitrary accounts.

## Idempotency Rules

- Every posting request requires `idempotencyKey`.
- `JournalEntry` already has unique `businessId + idempotencyKey`; future posting must use that constraint or a dedicated posting attempt record.
- Same key with the same transaction and same request payload returns the same existing result.
- Same key with a different transaction or different request payload is rejected.
- Successful retries must not create duplicate journal entries.
- Concurrent attempts must be safe. The implementation should use a database transaction and rely on a unique constraint or explicit posting attempt lock.
- AI tool calls must derive idempotency from stable tool-call identifiers, such as `conversationId-messageId-toolCallId`.
- Manual UI calls should use a stable client-generated key for the confirmed action.
- Imports should use stable source row/file identifiers.
- The result must include the accepted `idempotencyKey`.

## Atomicity Rules

Posting must happen in one database transaction:

1. Re-load the source transaction with `businessId`.
2. Confirm the source transaction is still postable.
3. Resolve and validate account mappings.
4. Build journal entry data.
5. Validate journal balance.
6. Create `JournalEntry`.
7. Create `JournalLine` rows.
8. Update `Transaction.status` to `POSTED`.
9. Store or return the idempotency result.
10. Later, create inventory movements where applicable.
11. Later, write audit log records.

If any step fails, nothing is committed. A transaction status must change only after journal persistence succeeds in the same database transaction.

## Status Rules

Transaction status rules:

- `DRAFT -> POSTED`: allowed only through the Posting Service after successful balanced journal persistence.
- `DRAFT -> VOIDED`: may be allowed for draft cancellation through existing or future void behavior.
- `POSTED -> VOIDED`: allowed only through future reversal workflow, not direct mutation.
- `VOIDED`: cannot post.

Journal entry status rules:

- `DRAFT/PENDING -> POSTED`: allowed through posting or approval workflow.
- `POSTED -> REVERSED/VOIDED`: allowed only through future reversal/void workflow.
- Posted journal lines must not be mutated directly.

Historical status rule:

- Existing historical `Transaction.status = POSTED` values must not be treated as ledger truth unless a matching posted `JournalEntry` exists or an explicit reconciliation/migration has established the ledger relationship.

## Validation Rules

The future implementation must validate:

- Header total equals the sum of transaction lines within currency rounding rules.
- Each transaction line has positive quantity where applicable.
- Each transaction line has non-negative unit price and positive total amount where applicable.
- Currency is present, valid, and consistent with business settings.
- Transaction date is valid.
- Posting date is valid and not before product policy allows.
- Accounting period is open once periods exist.
- Transaction status is postable.
- Customer belongs to business when required.
- Supplier belongs to business when required.
- Product references belong to business.
- Product line references belong to business.
- Account mappings exist for the transaction type and payment mode.
- Mapped accounts belong to business, are active, and are not deleted.
- Account types match expected roles where detectable.
- Journal lines are balanced.
- Journal line debit and credit values are non-negative.
- Every journal line has either debit or credit, not both.
- No journal line has both debit and credit as zero.
- Duplicate posting is blocked through idempotency.
- Cross-tenant IDs are rejected without revealing ownership.

## Error Handling

Safe error categories:

- `PERMISSION_DENIED`: authenticated user lacks active membership or posting permission.
- `TRANSACTION_NOT_FOUND`: transaction does not exist in the active business or is deleted.
- `UNSUPPORTED_TRANSACTION_TYPE`: no posting rules exist for the transaction type.
- `MISSING_REQUIRED_FIELDS`: transaction lacks required posting fields.
- `MISSING_ACCOUNT_MAPPING`: required mapping key is absent.
- `INACTIVE_ACCOUNT`: mapped or explicit account is inactive or deleted.
- `CROSS_TENANT_REFERENCE`: related ID does not belong to active business.
- `UNBALANCED_JOURNAL`: generated debits and credits do not match.
- `DUPLICATE_IDEMPOTENCY_KEY`: key was reused for incompatible payload.
- `STALE_TRANSACTION_STATUS`: transaction changed between preview and post.
- `CLOSED_ACCOUNTING_PERIOD`: posting date is not allowed.
- `CONCURRENT_POSTING_CONFLICT`: another posting attempt is active or won the race.

Error responses must not reveal whether another business owns a referenced ID. Prefer messages such as "Transaction not found for this business" or "Account mapping is not available for this business" over cross-tenant detail.

## Future API Design

These endpoints are design only and must not be treated as implemented.

### Posting Preview

```http
GET /businesses/:businessId/transactions/:transactionId/posting-preview
```

Behavior:

- Authenticates user.
- Verifies active membership and preview/read permission.
- Loads transaction by `businessId`.
- Validates required fields and mappings.
- Builds a journal preview.
- Returns debit/credit lines, warnings, and blocking errors.
- Does not persist a posted journal entry.
- Does not update `Transaction.status`.
- Does not create inventory movements.

### Post Transaction

```http
POST /businesses/:businessId/transactions/:transactionId/post
```

Behavior:

- Requires idempotency key.
- Requires posting permission.
- Requires confirmation when policy says so.
- Persists journal entry and journal lines atomically.
- Updates `Transaction.status` to `POSTED` only after journal success.
- Returns the posted journal entry result.

### Void Posted Transaction

```http
POST /businesses/:businessId/transactions/:transactionId/void
```

Behavior:

- Requires explicit void permission.
- Requires reason and idempotency key.
- For posted transactions, creates reversal journal entries instead of mutating original posted lines.
- Updates transaction status through reversal workflow only after reversal succeeds.

## AI Tool Boundary

Future AI may:

- Prepare a transaction draft.
- Request posting preview for a transaction.
- Explain preview lines and warnings to the user.
- Ask for explicit user confirmation.
- Call post endpoint after confirmation.
- Reuse stable tool-call IDs as idempotency seeds.

Future AI must not:

- Post without `activeBusinessId`.
- Post without active membership.
- Post without posting permission.
- Post without user confirmation where required.
- Post without idempotency key.
- Claim ledger success before the backend confirms a posted `JournalEntry`.
- Guess missing account mappings.
- Hide warnings or blocking validation errors.
- Use stale business context after business switch, logout, membership removal, or suspension.

Assistant wording must distinguish:

- Draft interpretation.
- Posting preview.
- Pending confirmation.
- Successfully posted journal entry.
- Failed or cancelled posting.

## Future Testing Plan

Posting implementation cannot be approved without tests for:

- Sale posting creates balanced journal lines.
- Expense posting creates balanced journal lines.
- Purchase posting creates balanced journal lines.
- Customer payment posting creates balanced journal lines.
- Supplier payment posting creates balanced journal lines.
- Adjustment posting requires explicit accounts and confirmation.
- Missing mapping fails safely.
- Inactive mapped account fails safely.
- Wrong account type fails where detectable.
- Unbalanced generated journal fails before persistence.
- Duplicate idempotency key does not duplicate journals.
- Same idempotency key with different payload is rejected.
- Concurrent posting creates at most one journal entry.
- Cross-tenant transaction access is denied.
- Cross-tenant account mapping access is denied.
- Viewer cannot post.
- Accountant and owner can post.
- Staff cannot post unless product policy changes.
- Transaction status updates atomically with journal creation.
- Failed posting leaves transaction unchanged.
- Existing historical `POSTED` transaction without journal is not reported as ledger truth.
- Posting preview does not persist journals or update transactions.
- AI-originated post requires confirmation and idempotency key.

## Implementation Phases

### Phase 1: Posting Preview Builder

- Build account mapping resolver.
- Build transaction validation helpers.
- Build journal preview builder.
- Return validation warnings and blocking errors.
- Do not persist posted journals.
- Do not update `Transaction.status`.

### Phase 2: Core Posting Service

- Implement idempotent posting for `SALE`, `EXPENSE`, and `PURCHASE`.
- Persist balanced `JournalEntry` and `JournalLine` rows.
- Update `Transaction.status` to `POSTED` atomically after journal success.
- Return posted journal result.

### Phase 3: Payments and Reversals

- Implement `CUSTOMER_PAYMENT`.
- Implement `SUPPLIER_PAYMENT`.
- Implement `ADJUSTMENT` with explicit account selection and confirmation.
- Design and implement void/reversal workflow.

### Phase 4: Accounting Controls

- Add inventory movements after inventory boundary approval.
- Add audit logs after audit boundary approval.
- Add accounting periods and closed-period protections.

### Phase 5: AI and Outputs

- Integrate AI tool execution with preview, confirmation, and posting.
- Build ledger-backed reports.
- Build PDF export from ledger-backed reports.

## Future Posting Acceptance Criteria

Future posting implementation is approved only when:

- Every post creates balanced journal lines.
- All posting writes are atomic.
- Every post is idempotent.
- Transaction status changes only after journal persistence succeeds.
- No cross-tenant access is possible.
- Membership and permissions are enforced.
- Reports use journal entries and journal lines, not transaction-intent records.
- AI cannot post silently.
- Errors are safe and test-covered.
- Failed posting leaves source records unchanged.
- Repeated successful retry returns the same result.
- Existing `Transaction.status = POSTED` records are reconciled before being treated as ledger truth.

## Current Non-Implementation Statement

This contract does not implement posting. It does not change Prisma schema, create migrations, add backend APIs, update transaction statuses, add inventory movements, add audit logs, integrate AI tools, persist chat, generate reports, export PDFs, add dashboards, add budgets or goals, connect banks, add OCR, or create mobile ledger UI.
