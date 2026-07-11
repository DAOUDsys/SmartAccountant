# Changelog

## 0.1.18 - 2026-07-11

### Added

- Added `TransactionAdjustmentLine` schema for dedicated adjustment debit/credit intent lines.
- Added `Transaction.adjustmentReason` for ADJUSTMENT reason/header support.
- Added migration `20260711161000_add_adjustment_lines`.
- Added dedicated `adjustments.read`, `adjustments.manage`, and `adjustments.preview` permissions for OWNER, ADMIN, and ACCOUNTANT.
- Added guarded adjustment endpoints:
  - `GET /businesses/:businessId/transactions/:transactionId/adjustment-lines`
  - `PUT /businesses/:businessId/transactions/:transactionId/adjustment-lines`
  - `POST /businesses/:businessId/transactions/:transactionId/adjustment-preview`
- Added validation for explicit adjustment lines, same-business active accounts, non-negative one-sided debit/credit amounts, balanced totals, required description, required reason, and DRAFT ADJUSTMENT status.
- Added preview-only ADJUSTMENT response lines with sensitive-account warnings.
- Added minimal mobile adjustment line and adjustment preview types plus API methods.
- Added focused backend tests for adjustment line storage, tenant scoping, validation failures, permissions, preview behavior, no ledger persistence, and existing ADJUSTMENT posting rejection.

### Verified

- Pre-check `npm.cmd run lint` passed.
- Pre-check `npm.cmd run build` passed.
- Pre-check `npm.cmd run test` passed with 18 files and 129 tests.
- Pre-check `npm.cmd run prisma:validate` passed with `DATABASE_URL`.
- Pre-check `npm.cmd run prisma:generate` passed with `DATABASE_URL`.
- Focused adjustment, permission, and posting tests passed with 3 files and 47 tests.
- Final `npm.cmd run lint` passed.
- Final `npm.cmd run build` passed.
- Final `npm.cmd run test` passed with 19 files and 139 tests.
- Final `npm.cmd run prisma:validate` passed with `DATABASE_URL`.
- Final `npm.cmd run prisma:generate` passed with `DATABASE_URL`.
- Docker/PostgreSQL was restored with `docker compose up -d postgres`; `smartaccountant_dev` accepts connections on `localhost:5432`.
- `npx.cmd prisma migrate deploy --schema apps/backend/prisma/schema.prisma` reports no pending migrations after applying `20260711161000_add_adjustment_lines`.
- `npx.cmd prisma migrate status --schema apps/backend/prisma/schema.prisma` reports the database schema is up to date.
- Live ADJUSTMENT smoke test passed against the running NestJS backend and Docker PostgreSQL: user A registration, default business/accounts, DRAFT ADJUSTMENT creation, Cash debit and Owner Equity credit line save/readback, balanced preview, sensitive-account warnings, safe ADJUSTMENT posting rejection, user B cross-tenant denial, unbalanced-line rejection, and unchanged product quantity.
- Direct database inspection passed: `TransactionAdjustmentLine` table exists, `Transaction.adjustmentReason` column exists, stored lines reference the correct business and transaction, no `JournalEntry` was created, no `JournalLine` was created, the transaction remained `DRAFT`, and no `InventoryMovement` or `AuditLog` tables exist.
- ADJUSTMENT line schema + preview foundation is approved.

### Previously Blocked

- `docker compose up -d postgres` could not start PostgreSQL because Docker Desktop was not reachable.
- `npx prisma migrate dev --schema apps/backend/prisma/schema.prisma --name add_adjustment_lines` reached the Prisma schema engine but did not create/apply a migration.
- `npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma` hit the same schema engine failure.
- `npx prisma db execute --schema apps/backend/prisma/schema.prisma --file apps/backend/prisma/migrations/20260711161000_add_adjustment_lines/migration.sql` reported `P1001` because the database server at `localhost:5432` was not running.
- This blocker is resolved as of the final verification on 2026-07-11.

### Boundary Notes

- ADJUSTMENT preview does not create `JournalEntry`.
- ADJUSTMENT preview does not create `JournalLine`.
- ADJUSTMENT preview does not update `Transaction.status`.
- ADJUSTMENT posting remains blocked in the existing posting endpoint.
- No reversals, inventory movement automation, sale COGS posting, audit logs, accounting periods, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile adjustment UI were added.

### Pending

- ADJUSTMENT posting remains future work and requires separate approval.

## 0.1.17 - 2026-07-11

### Added

- Added `ADJUSTMENT_POSTING_DESIGN.md` as the source-of-truth design for future safe ADJUSTMENT preview and posting.
- Documented why ADJUSTMENT posting is high risk and must require explicit debit and credit account selection.
- Documented future adjustment categories, with the first implementation limited to simple manual financial adjustments.
- Defined required future adjustment input: description, reason, posting date, currency handling, and explicit account debit/credit lines.
- Evaluated the current `TransactionLine` model and concluded it should not be overloaded for adjustment account lines because it is product/quantity/price oriented and cannot store `accountId`, `debitAmount`, or `creditAmount`.
- Recommended future dedicated `TransactionAdjustmentLine` storage before implementing ADJUSTMENT preview or posting.
- Defined future preview behavior, posting behavior, account rules, permissions, safety gates, safe errors, AI boundary, testing plan, implementation phases, and acceptance criteria.

### Verified

- This phase is documentation/design only.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run test` passed with 18 files and 129 tests.
- `npm.cmd run prisma:validate` passed with `DATABASE_URL`.
- `npm.cmd run prisma:generate` passed with `DATABASE_URL`.
- No Prisma schema change or migration was created.
- No backend API, posting logic, `Transaction.status` behavior, inventory movement, audit log, accounting period, AI orchestration, chat persistence, report, PDF, dashboard, budget/goal, bank/OCR, or mobile posting UI implementation was added.

### Pending

- ADJUSTMENT preview implementation remains future work.
- Future implementation should start with an approved adjustment line schema/DTO and non-persisted preview validation.
- ADJUSTMENT posting remains blocked until explicit adjustment lines and preview validation are implemented and approved.
- Reversals, inventory movement automation, sale COGS posting, audit logs, accounting periods, AI tool execution, ledger-backed reports, PDFs, dashboards, and mobile posting UI remain future work.

## 0.1.16 - 2026-07-11

### Added

- Added Payment Posting Phase 3 for `CUSTOMER_PAYMENT` and `SUPPLIER_PAYMENT`.
- Reused `POST /businesses/:businessId/transactions/:transactionId/post` for payment posting.
- Reused `journalEntries.post`, allowed for OWNER, ADMIN, and ACCOUNTANT through the existing permission mapping.
- Added `CUSTOMER_PAYMENT` posting rules: require same-business `customerId`, debit Cash, and credit Accounts Receivable.
- Added `SUPPLIER_PAYMENT` posting rules: require same-business `supplierId`, debit Accounts Payable, and credit Cash.
- Added payment posting validation for required party references, same-business party references, positive totals, currency, line total matching, required account mappings, active mapped accounts, and expected mapped account types.
- Reused tenant-scoped idempotency so same business + same idempotency key + same transaction returns the existing posted journal, while conflicting reuse is rejected.
- Reused the atomic database transaction that creates a POSTED `JournalEntry`, creates balanced `JournalLine` records, and updates `Transaction.status` to `POSTED`.
- Added focused backend tests for payment posting journal lines, required customer/supplier references, cross-tenant party rejection, missing mappings, wrong account types, idempotent retry, duplicate prevention, permissions, `ADJUSTMENT` rejection, unchanged product quantity, and no InventoryMovement or AuditLog behavior.

### Verified

- `docker compose up -d postgres` confirms local PostgreSQL is running.
- No Prisma migration was created or required.
- Pre-check `npm.cmd run lint` passed.
- Pre-check `npm.cmd run build` passed.
- Pre-check `npm.cmd run test` passed with 18 files and 124 tests.
- Pre-check `npm.cmd run prisma:validate` passed with `DATABASE_URL`.
- Pre-check `npm.cmd run prisma:generate` passed with `DATABASE_URL`.
- Focused payment and membership tests passed with 2 files and 37 tests.
- Final `npm.cmd run lint` passed.
- Final `npm.cmd run build` passed.
- Final `npm.cmd run test` passed with 18 files and 129 tests.
- Final `npm.cmd run prisma:validate` passed with `DATABASE_URL`.
- Final `npm.cmd run prisma:generate` passed with `DATABASE_URL`.
- Live smoke test passed for registering user A, confirming 8 mappings, creating a customer, creating a supplier, creating a product with quantity 7, posting a DRAFT `CUSTOMER_PAYMENT`, confirming Cash debit and Accounts Receivable credit, confirming `Transaction.status = POSTED`, retrying the same idempotency key with the same journal, confirming product quantity stayed 7, posting a DRAFT `SUPPLIER_PAYMENT`, confirming Accounts Payable debit and Cash credit, registering user B, denying user B with 403, and safely rejecting `ADJUSTMENT` with 400. Tokens were masked.

### Boundary Notes

- Payment posting uses general Accounts Receivable and Accounts Payable mappings only.
- No invoice-level allocation, AR/AP aging, customer statement reconciliation, or supplier statement reconciliation was added.
- No ADJUSTMENT posting, reversals, inventory movement automation, sale COGS posting, audit logs, accounting periods, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI were added.
- Historical transaction-intent `POSTED` records without a matching posted journal are still not treated as ledger truth and require reconciliation.

### Pending

- `ADJUSTMENT` posting with explicit debit and credit accounts remains future work.
- Invoice-level payment allocation, AR/AP aging, and customer/supplier statement reconciliation remain future work.
- Request-hash storage for stronger idempotency payload comparison remains future work.
- Reversals, inventory movements, sale COGS posting, audit logs, accounting periods, AI tool execution, ledger-backed reports, PDFs, dashboards, and mobile posting UI remain future work.

## 0.1.15 - 2026-07-11

### Added

- Added Core Posting Service Phase 2 for `SALE`, `EXPENSE`, and `PURCHASE`.
- Added `POST /businesses/:businessId/transactions/:transactionId/post`.
- Added request validation for required `idempotencyKey`, optional `postingDate`, and supported source values `MANUAL`, `SYSTEM_RETRY`, and `IMPORT`.
- Added atomic posting that creates a POSTED `JournalEntry`, creates balanced `JournalLine` records, and updates `Transaction.status` to `POSTED` in one database transaction.
- Added idempotency behavior using the existing tenant-scoped `JournalEntry.businessId + idempotencyKey` unique constraint.
- Added safe rejection for unsupported `CUSTOMER_PAYMENT`, `SUPPLIER_PAYMENT`, and `ADJUSTMENT` posting.
- Added minimal mobile post transaction response types and API method.
- Added focused backend tests for posting rules, idempotency, atomicity ordering, permissions, unsupported types, mapping errors, cross-tenant safety, no inventory/audit behavior, and historical POSTED boundary.

### Verified

- `docker compose up -d postgres` confirms local PostgreSQL is running.
- Existing Prisma migrations had no pending changes.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes with 18 files and 124 tests.
- `npm.cmd run prisma:validate` passes with `DATABASE_URL`.
- `npm.cmd run prisma:generate` passes with `DATABASE_URL`.
- Live smoke test passed for sale posting, expense posting, purchase posting, balanced journal lines, `Transaction.status = POSTED`, idempotent retry returning the same journal, duplicate posting rejection with a different key, user B cross-tenant denial with 403, unchanged product quantity, and safe 400 rejection for CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, and ADJUSTMENT.

### Boundary Notes

- Posting is implemented only for SALE, EXPENSE, and PURCHASE.
- Purchase product lines warn that inventory quantity movement is not implemented.
- Sale product lines warn that inventory and COGS posting is not implemented.
- No CUSTOMER_PAYMENT posting, SUPPLIER_PAYMENT posting, ADJUSTMENT posting, inventory movement automation, COGS posting, audit logs, accounting periods, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI were added.
- Historical transaction-intent `POSTED` records without a matching posted journal are not treated as ledger truth and require reconciliation.

### Pending

- Payment posting remains future work.
- Adjustment posting with explicit debit and credit accounts remains future work.
- Request-hash storage for stronger idempotency payload comparison remains future work.
- Reversals, inventory movements, sale COGS posting, audit logs, accounting periods, AI tool execution, ledger-backed reports, PDFs, dashboards, and mobile posting UI remain future work.

## 0.1.14 - 2026-07-11

### Added

- Added the backend Posting Preview Builder under `apps/backend/src/features/posting`.
- Added `GET /businesses/:businessId/transactions/:transactionId/posting-preview`.
- Added `postingPreview.read`, allowed for OWNER, ADMIN, and ACCOUNTANT.
- Added preview support for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`.
- Added safe `ADJUSTMENT` preview rejection until explicit debit and credit accounts are designed.
- Added minimal mobile posting preview response types and read-only API method.
- Added focused backend tests for preview generation, mapping validation, tenant scoping, permission behavior, status boundaries, unbalanced preview validation, and no persistence.

### Verified

- `docker compose up -d postgres` confirms local PostgreSQL is running.
- Existing Prisma migrations had no pending changes.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes with 17 files and 105 tests.
- `npm.cmd run prisma:validate` passes with `DATABASE_URL`.
- `npm.cmd run prisma:generate` passes with `DATABASE_URL`.
- Live smoke test passed for registering user A, confirming 8 mappings, creating a draft sale, returning a balanced preview, confirming journal count stayed 0, confirming `Transaction.status` stayed `DRAFT`, denying user B with 403, rejecting `ADJUSTMENT` safely, and returning `MISSING_ACCOUNT_MAPPING` after deleting CASH mapping for the smoke business.

### Boundary Notes

- Posting preview is read-only and non-persisted.
- No full posting service, `Transaction.status` update, posted journal entry creation, journal line creation, inventory movement automation, audit logs, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI were added.
- `Transaction.status = POSTED` remains transaction-intent state only and is blocked from preview with boundary-safe wording until posting reconciliation is designed.

### Pending

- Core Posting Service Phase 2 remains future work.
- `ADJUSTMENT` preview requires explicit debit and credit account design in a future task.
- Inventory and COGS preview lines for product sales remain future work.

## 0.1.13 - 2026-07-11

### Added

- Added `project-management/POSTING_SERVICE_CONTRACT.md` as the architecture source of truth for the future posting service.
- Defined future posting service responsibilities and non-responsibilities.
- Defined future `postTransaction` method contract, posting sources, result shape, safety gates, transaction type posting rules, account mapping rules, idempotency rules, atomicity rules, status rules, validation rules, safe error categories, future API design, AI tool boundary, testing plan, implementation phases, and acceptance criteria.

### Changed

- Updated project-management status and task tracking to show JournalEntry / JournalLine foundation is approved and Posting Service contract design is complete.
- Set the next recommended task to posting preview builder implementation, not full posting.

### Verified

- Confirmed this was documentation/design only.
- Confirmed the contract keeps current `Transaction` records as intent records and does not treat `Transaction.status = POSTED` as ledger truth without a matching posted journal pathway.

### Boundary Notes

- No Prisma schema changes, migrations, backend APIs, posting service logic, `Transaction.status` update logic, inventory movement automation, audit logs, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile ledger UI were implemented.

### Pending

- Posting preview builder remains future work.
- Full posting service remains future work.
- Inventory movements, audit logs, accounting periods, AI tool execution, reports, PDFs, dashboards, and polished mobile ledger UI remain future work.

## 0.1.12 - 2026-07-11

### Added

- Added migration `20260710233859_add_journal_foundation`.
- Added tenant-scoped `JournalEntry` and `JournalLine` Prisma models.
- Added `JournalEntryStatus` enum with `DRAFT`, `PENDING`, `POSTED`, `VOIDED`, and `REVERSED`.
- Added required tenant-scoped `idempotencyKey` storage with a unique `businessId + idempotencyKey` constraint.
- Added guarded read endpoints under `/businesses/:businessId/journal-entries`.
- Added draft-only journal endpoint `POST /businesses/:businessId/journal-entries/draft`.
- Added `journalEntries.read`, `journalEntries.manage`, `journalEntries.createDraft`, `journalEntries.post`, and `journalEntries.void` permissions. `post` and `void` are defined for future use only.
- Added internal journal balancing helpers for debit/credit totals, balanced-line validation, and same-business active account validation.
- Added minimal mobile journal entry and journal line response types plus read-only API methods.
- Added focused backend tests for schema shape, balancing validation, account validation, tenant filtering, cross-tenant denial, draft creation safety, and journal permissions.

### Changed

- Updated project-management status and task tracking to mark JournalEntry / JournalLine foundation approved.
- Updated README accounting API documentation with journal endpoints and the continued transaction-intent boundary.

### Verified

- `docker compose up -d postgres` confirms local PostgreSQL is running.
- `npx prisma migrate dev --schema apps/backend/prisma/schema.prisma --name add_journal_foundation` created and applied `20260710233859_add_journal_foundation`.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes with 15 files and 86 tests.
- `npm.cmd run prisma:validate` passes with `DATABASE_URL`.
- `npm.cmd run prisma:generate` passes with `DATABASE_URL`.
- Live smoke test passed for registering user A, confirming default accounts, creating a balanced draft journal entry using Cash and Owner Equity, reading journal list/detail with lines, registering user B, denying user B guessed access to business A journal detail with 403, and rejecting unbalanced draft creation with 400.

### Boundary Notes

- Journal entries and journal lines are storage/read foundation only.
- Draft journal creation does not post transactions and does not update `Transaction.status`.
- `Transaction.status = POSTED` remains transaction-intent state only until a future posting service creates balanced journal entries and lines through the approved posting pathway.
- No posting service, automatic transaction posting, inventory movement automation, audit logs, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or polished mobile ledger UI were added.

### Pending

- Posting service remains future work.
- Automatic `Transaction.status` updates remain future work.
- Inventory movements, audit logs, accounting periods, reports, PDFs, dashboards, AI tool execution, and polished mobile ledger UI remain future work.

## 0.1.11 - 2026-07-11

### Added

- Added migration `20260710231017_add_chart_of_accounts`.
- Added tenant-scoped `Account` and `AccountMapping` Prisma models.
- Added `AccountType`, `NormalBalance`, and `AccountMappingKey` enums.
- Added idempotent default system accounts for Cash, Accounts Receivable, Inventory Asset, Accounts Payable, Owner Equity, Sales Revenue, Cost of Goods Sold, and General Expense.
- Added default account mappings for future posting configuration.
- Added guarded tenant-scoped account endpoints under `/businesses/:businessId/accounts`.
- Added guarded tenant-scoped account-mapping endpoints under `/businesses/:businessId/account-mappings`.
- Added `accounts.read`, `accounts.manage`, `accountMappings.read`, and `accountMappings.manage` permissions.
- Added safe local backfill script `npm run accounts:backfill-defaults --workspace @finance-ai/backend` for existing businesses.
- Added minimal mobile account and account-mapping response types plus read-only API methods.
- Added focused backend tests for defaults, account rules, permissions, tenant isolation, system protections, soft delete, and mappings.

### Changed

- Registration now creates default account configuration for the default business in the same transaction.
- `POST /businesses` now creates default account configuration for the new business in the same transaction.
- Updated project-management status and task tracking to mark Chart of Accounts foundation approved.

### Verified

- `docker compose up -d postgres` confirms local PostgreSQL is running.
- `npx prisma migrate dev --schema apps/backend/prisma/schema.prisma --name add_chart_of_accounts` created and applied `20260710231017_add_chart_of_accounts`.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes with 12 files and 65 tests.
- `npm.cmd run prisma:validate` passes with `DATABASE_URL`.
- `npm.cmd run prisma:generate` passes with `DATABASE_URL`.
- `npm.cmd run accounts:backfill-defaults --workspace @finance-ai/backend` backfilled 7 existing non-deleted local businesses through idempotent upserts.
- Live smoke test passed for registering user A, confirming 8 default accounts and 8 mappings, creating a custom expense account, registering user B, denying user B guessed access to business A accounts with 403, confirming user B has independent default code `1000`, rejecting system-account deletion with 403, and soft-deleting the custom account so it is excluded from normal lists.

### Boundary Notes

- Account mappings are configuration for future posting only.
- `Transaction.status = POSTED` is still not real ledger posting.
- No `JournalEntry`, `JournalLine`, posting service, double-entry ledger, inventory movement automation, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or polished mobile account CRUD screens were added.

### Pending

- JournalEntry/JournalLine foundation remains future work.
- Posting service, double-entry ledger reporting, inventory movements, accounting periods, audit logs, AI tool execution, reports, PDFs, dashboards, and polished mobile account UI remain future work.

## 0.1.10 - 2026-07-11

### Added

- Added `project-management/ACCOUNTING_ENGINE_BOUNDARY.md` as the architecture source of truth for future ledger posting.
- Defined the boundary between current transaction-intent records and future double-entry accounting postings.
- Documented future chart of accounts, account, journal entry, journal line, inventory movement, and audit log model designs.
- Documented posting rules, posting lifecycle, idempotency, void/reversal rules, inventory boundary, tenant isolation, permission rules, AI tool boundary, validation rules, error handling, implementation phases, and future acceptance criteria.

### Changed

- Updated project-management status and task tracking to show the tenant-scoped accounting data foundation is approved and accounting engine boundary design is complete.
- Set the next recommended task to Chart of Accounts foundation.

### Verified

- Confirmed this was documentation/design only.
- No Prisma schema changes, migrations, backend APIs, mobile UI, ledger posting, inventory movement automation, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, or OCR were implemented.

### Pending

- Chart of Accounts foundation remains future work.
- Double-entry journal entries, posting service, reversals, inventory movements, audit logs, accounting periods, AI tool execution, reports, and PDF exports are not implemented yet.

## 0.1.9 - 2026-07-11

### Added

- Added migration `20260710222110_add_accounting_foundation`.
- Added tenant-scoped Prisma models for `Customer`, `Supplier`, `Product`, `Transaction`, and `TransactionLine`.
- Added `TransactionType` and `TransactionStatus` enums.
- Added tenant-scoped customer, supplier, product, and transaction APIs under `/businesses/:businessId/...`.
- Added accounting permissions for customers, suppliers, products, and transactions.
- Added related-record validation so transactions can only reference customers, suppliers, and products from the same business.
- Added minimal mobile accounting response types and read-only API methods.
- Added focused tests for customer, supplier, product, transaction, permission, soft-delete, cross-tenant, SKU uniqueness, and void behavior.

### Verified

- `docker compose up -d postgres` confirms local PostgreSQL is running.
- `npx prisma migrate dev --schema apps/backend/prisma/schema.prisma --name add_accounting_foundation` created and applied `20260710222110_add_accounting_foundation`.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes with 10 files and 48 tests.
- `npm.cmd run prisma:validate` passes with `DATABASE_URL`.
- `npm.cmd run prisma:generate` passes with `DATABASE_URL`.
- Live smoke test passed for registering user A, creating a customer, supplier, product, and sale transaction under business A, registering user B, denying user B guessed customer/product/transaction access with 403, confirming lists return active business records, and voiding a transaction as an authorized owner.

### Security Notes

- Every new tenant-owned model includes `businessId`.
- Every new backend service method filters by `businessId`.
- Normal lists exclude `deletedAt` records.
- Product SKU uniqueness is scoped by business.
- Customer, supplier, and product IDs on transactions are verified against the active business before write.
- Transaction line product IDs are verified against the active business before write.
- VIEWER can read only; STAFF can read and create transactions; ACCOUNTANT, ADMIN, and OWNER can manage core accounting records and void transactions.

### Pending

- No double-entry ledger yet.
- No finalized accounting engine or posting workflow yet.
- No automatic inventory movement engine yet.
- No AI tool execution or DeepSeek integration yet.
- No chat persistence yet.
- No reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or polished mobile CRUD screens yet.

## 0.1.8 - 2026-07-10

### Added

- Added Prisma tenancy models: `Business`, `BusinessMember`, `BusinessRole`, and `BusinessMemberStatus`.
- Added migration `20260710151650_add_tenancy_foundation`.
- Added transactional default business creation during registration with ACTIVE OWNER membership.
- Added backend businesses module with `GET /businesses`, `GET /businesses/active`, `POST /businesses`, `GET /businesses/:businessId`, `GET /businesses/:businessId/members`, and `POST /businesses/:businessId/members`.
- Added `BusinessMembershipGuard`, `RequireBusinessRole`, `CurrentBusiness`, and business permission helpers.
- Added mobile business types, business API client, active business SecureStore persistence, active business Zustand store, and auth-store integration for loading and clearing active business state.
- Added focused backend and mobile tests for tenancy registration, business scoping, membership guard behavior, role checks, active business selection, and logout clearing.

### Verified

- `docker compose up -d postgres` confirms local PostgreSQL is running.
- `npx prisma migrate dev --schema apps/backend/prisma/schema.prisma --name add_tenancy_foundation` created and applied `20260710151650_add_tenancy_foundation`.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes with 6 files and 31 tests.
- `npm.cmd run prisma:validate` passes with `DATABASE_URL`.
- `npm.cmd run prisma:generate` passes with `DATABASE_URL`.
- Live smoke test passed for registration creating a default business, ACTIVE OWNER membership creation, `GET /businesses`, `GET /businesses/active`, owner access to own business, and 403 denial when another user guesses the business id.

### Security Notes

- Tenant-scoped business detail/member endpoints verify ACTIVE membership before returning data.
- Suspended, removed, invited-only, and deleted-business memberships are excluded by the guard and list queries.
- Role-protected member endpoints require OWNER or ADMIN.
- JWT still contains user identity only; mobile stores active business locally while backend verifies membership per request.

### Pending

- Full invitation email flow is not implemented.
- Member removal, suspension, and role editing endpoints are not implemented.
- Mobile has active business state foundation only; no polished business switcher yet.
- Tenant-scoped accounting models, tenant-scoped AI tools, chat persistence, inventory, reports, PDFs, budgets, and goals remain future work.

## 0.1.7 - 2026-07-10

### Added

- Added `project-management/TENANCY_AUTHORIZATION.md` as the architecture source of truth for tenant-aware authorization.
- Defined the future business/tenant model, memberships, roles, permissions, active business behavior, backend authorization strategy, AI tool authorization rules, data isolation rules, security risks, and phased implementation plan.

### Changed

- Updated project-management status and task tracking to show Authentication Foundation is approved and tenant-aware authorization design is complete.
- Set the next recommended task to tenant-aware authorization implementation foundation.

### Verified

- Confirmed this was documentation/design only.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes with 3 files and 17 tests.
- `npm.cmd run prisma:validate` passes when `DATABASE_URL` is provided.
- `npm.cmd run prisma:generate` passes when `DATABASE_URL` is provided.
- No Prisma schema changes, migrations, backend APIs, mobile UI, AI orchestration, chat persistence, accounting, inventory, reports, PDFs, budgets, or goals were implemented.

### Pending

- Tenant-aware authorization implementation remains future work.
- Business and membership Prisma models, membership guards, active-business endpoints, mobile business switcher, tenant-scoped accounting models, and AI tool enforcement are not implemented yet.

## 0.1.6 - 2026-07-10

### Added

- Added `expo-dev-client@~5.0.20` to prepare the Expo development-build fallback for Android auth QA after Expo Go transport failures.
- Captured Android auth QA evidence under `project-management/screenshots/auth-qa/` for login, register, authenticated Chat UI, invalid login, duplicate registration, logout return-to-login, session restore, and the earlier Expo Go transport failure path.

### Verified

- Confirmed Docker PostgreSQL is running for local auth QA.
- Confirmed Android unauthenticated login and register screens render on the rebooted `Pixel_9_API_35` emulator.
- Verified mobile registration for `mobileqa@example.com` succeeds against the live backend and routes to the authenticated Chat UI.
- Verified mobile logout clears local session state and returns to login.
- Verified invalid login shows `Invalid email or password.` without crashing.
- Verified valid login succeeds against the live backend and routes to the authenticated Chat UI.
- Verified force-stop/relaunch restores the authenticated session and lands on the Chat UI.
- Verified duplicate registration shows `An account with this email already exists.` without crashing.
- Verified the mobile app uses the Android emulator backend URL `http://10.0.2.2:3000` for auth QA.
- Confirmed the earlier Expo Go failure was a launch/transport issue, not a backend auth failure and not the earlier root-layout navigation bug.
- Confirmed no accounting, AI provider, chat persistence, inventory, reporting, PDF, budget, or goal logic was changed.
- Authentication Foundation is approved for this phase.

### Pending

- Expo Go still reports `versionName=2.32.19` after installing the cached SDK 52 APK named `Expo-Go-2.32.20.apk`, but this did not block the final approved emulator QA run.
- Expo development-build fallback remains prepared with `expo-dev-client`, but was not needed for final auth QA approval. This machine still needs a JDK/`JAVA_HOME` before local Gradle development builds can compile.
- Email verification, password reset, social login, organization/team membership, production secrets, and deployment configuration remain future work.

## 0.1.5 - 2026-07-10

### Added

- Added Docker Compose local PostgreSQL service using `postgres:16-alpine` with persistent storage and `smartaccountant_dev`.
- Added Prisma migration `20260709234821_init_auth` for the existing `UserRole`, `User`, and `RefreshToken` auth schema.
- Added backend authentication foundation with register, login, refresh, logout, and current-user endpoints.
- Added Prisma `User`, `RefreshToken`, and `UserRole` auth schema.
- Added bcrypt password hashing, hashed refresh-token storage, JWT access tokens, refresh-token rotation, auth guard, DTO validation, and environment validation.
- Added mobile login and register screens.
- Added mobile auth Zustand store, typed auth API client, Expo SecureStore token storage, session restore, route guard, and logout.
- Added focused backend and mobile auth tests.
- Added safe auth environment examples for JWT secrets, token lifetimes, bcrypt rounds, and mobile API URL.
- Added Vitest as the minimal TypeScript logic test runner.
- Added focused chat store tests for the local Zustand chat foundation.
- Added `project-management/CHAT_AI_BOUNDARY.md` to define the future Chat UI and AI Orchestrator contract.
- Added GitHub Actions `CI` workflow for pushes and pull requests to `main`.
- Added Prisma schema validation script for CI.
- Documented `npm run test` in the README scripts.

### Changed

- Updated local database setup documentation and `.env.example` to use `smartaccountant_dev`.
- Moved auth redirects out of the Expo Router root layout so the root `Stack` mounts immediately before any route guard navigation.
- Added route-level authenticated and guest guards for app, chat, login, and register routes.
- Flattened the repository structure so `apps/`, `packages/`, `project-management/`, `docs/`, and root configuration files now live at the GitHub repository root instead of under `finance-ai/`.
- Updated the README folder structure diagram and project-management notes to reflect the new root layout.
- Expanded root ignore rules for workspace `node_modules`, Expo export output, environment files, build output, coverage, logs, and OS metadata.

### Verified

- `docker compose up -d postgres` starts local PostgreSQL successfully.
- Prisma migration `20260709234821_init_auth` applies successfully to `smartaccountant_dev`.
- Live backend auth endpoint smoke tests pass for health, register, duplicate register rejection, login, `/auth/me`, refresh rotation, old refresh-token reuse rejection, logout, refresh-after-logout rejection, and wrong-password rejection.
- API smoke tests confirmed user responses do not include `passwordHash`.
- Refresh-token DB inspection confirmed stored refresh tokens are SHA-256 hashes, not plaintext.
- No accounting, AI provider, chat persistence, inventory, reporting, PDF, budget, or goal logic was changed.
- `npm run test` passes with 3 Vitest files and 17 tests.
- `npm run lint` passes.
- `npm run build` passes.
- `npm run prisma:validate` passes with a dummy CI `DATABASE_URL`.
- `npm run prisma:generate` passes with a dummy CI `DATABASE_URL`.
- GitHub Actions CI was confirmed green for commit `4e57a1634d3d12707510b9a2d60751a8dfdef7f4` before auth work began.
- GitHub Actions workflow syntax was reviewed by inspection and will be verified by GitHub after push.
- Android Expo Go launch on `Pixel_9_API_35` renders the unauthenticated login screen without the root-layout navigation error.
- `npx expo export --platform android --output-dir .expo-export-check` passes after rerun outside sandbox for Hermes compiler permissions.

### Pending

- Android mobile auth flow QA remains pending. Expo Go on the current emulator fails before React loads with `UpdateFailedToLoad` while downloading the Metro update, even though Metro runs and backend auth is live.
- Successful mobile screenshots for login, register, authenticated Chat UI, invalid login, logout, and session restore are not captured yet.
- Email verification, password reset, social login, organization/team membership, production secrets, and deployment configuration are not implemented yet.

## 0.1.4 - 2026-07-09

### Added

- Added Android QA runner scripts with longer waits, UI text readiness checks, Expo loading overlay avoidance, and focused retry/dark/clear flows.
- Captured reviewed Chat UI QA screenshots under `project-management/screenshots/chat-ui`.

### Fixed

- Fixed a native settings sheet render error: `node.addEventListener is not a function`.
- Removed Tamagui CSS animation props from the native chat settings sheet overlay and switch thumbs.

### Verified

- Chat UI Sprint 1 is approved on the `Pixel_9_API_35` Android emulator through Expo Go.
- Captured screenshots for conversation list, chat thread, composer-ready send flow, typing/streaming, assistant response, settings sheet, retry UI, dark mode, and clear conversation.
- Verified `simulate error` shows retry UI and retry re-runs the local mock assistant response.
- Verified clear conversation works locally and shows `Conversation cleared locally. No backend records were changed.`
- `npm run lint` passes.
- `npm run build` passes.
- `npx @tamagui/cli check` reports `Tamagui dependencies look good`.
- `npx expo export --platform android --output-dir .expo-export-check` passes with dependency validation disabled for the known Expo CLI validation issue.
- No backend, Prisma schema, AI provider, authentication, database, or accounting logic was changed.

## 0.1.3 - 2026-07-09

### Changed

- Updated local mock assistant copy so responses do not say transactions were saved, recorded, or created.
- Updated the chat empty-state persistence note to say backend records stay unchanged.

### Verified

- `npm run lint` passes.
- `npm run build` passes.
- `npx @tamagui/cli check` reports `Tamagui dependencies look good`.
- `npx expo export --platform android --output-dir .expo-export-check` passes with dependency validation disabled for the known Expo CLI validation issue.

### Android QA Result

- Downloaded the SDK 52 recommended `Expo-Go-2.32.20.apk` through Expo CLI.
- Uninstalled and reinstalled Expo Go on the `Pixel_9_API_35` emulator.
- Android still reports Expo Go `versionName=2.32.19` after reinstall.
- Expo CLI can install Expo Go and Metro can bundle `expo-router/entry`.
- The Chat UI can render and the current remaining QA issue is screenshot automation timing on a slow emulator, not a functional UI render failure.
- Future Android QA runs should wait for actual UI text or selectors and retry if Expo Go loading or bundling overlay text is still visible.
- Required visual QA screenshots were not captured and reviewed yet, so Chat UI Sprint 1 remains pending.
- No backend, Prisma schema, AI provider, authentication, database, or accounting logic was changed.

## 0.1.2 - 2026-07-09

### Changed

- Refined the conversation list header subtitle to avoid clipping on Android.
- Reduced the `Finance AI` screen title scale and line height for a calmer app-screen feel.
- Improved the search and New button row alignment, touch height, and proportions.
- Softened conversation card borders, spacing, pressed state, and text wrapping.
- Added clearer accessibility labels for disabled settings placeholders.

### Fixed

- Removed remaining `$gray5` token usage from chat header and composer borders.
- Replaced those borders with `$gray6`, which is available in the active Tamagui config.

### Verified

- `rg "$gray5|gray5" apps/mobile/src packages`: no remaining matches.
- `npm run lint` passes.
- `npm run build` passes.
- `npx @tamagui/cli check` reports `Tamagui dependencies look good`.
- `npx expo export --platform android --output-dir .expo-export-check` passes.
- Android offline launch bundles successfully and reaches `Running "main"` without Expo Router, `expo-linking`, Tamagui config, or `$gray5` log errors.

### Pending

- Chat UI Sprint 1 is not fully approved yet.
- Final Android screenshots for the polished conversation list, chat thread, send flow, typing/streaming state, settings sheet, and dark mode remain blocked by the available emulator. Expo CLI reports Expo Go `2.32.20` is recommended for SDK 52, but the emulator has `2.32.19`; non-interactive CLI cannot accept the install prompt, and the offline launch remains on Expo's bundling overlay.
- No backend, Prisma schema, AI provider, authentication, database, or accounting logic was changed.

## 0.1.1 - 2026-07-09

### Fixed

- Fixed the blocking Expo/Tamagui runtime error: `Can't find Tamagui configuration`.
- Added canonical `apps/mobile/tamagui.config.ts` using `createTamagui()` and `@tamagui/config/v4`.
- Updated the Expo Router root layout to pass the app-local Tamagui config directly to `TamaguiProvider`.
- Re-exported the mobile Tamagui config from the mobile theme module for local compatibility.
- Updated the shared config package to use the same Tamagui v4 default config path.
- Pinned direct `tamagui` and `@tamagui/*` package specs to exact `1.144.4` across mobile, config, and UI workspaces.
- Added `react-dom@18.3.1` and `react-native-web@~0.19.13` for Expo/Tamagui-compatible config loading.
- Ran dependency dedupe to remove duplicate nested Tamagui copies from the workspace install.
- Replaced the Android-crashing Tamagui `TextArea` in the chat composer with React Native `TextInput`.
- Fixed assistant Markdown bubble sizing so text does not collapse into a narrow column on Android.

### Verified

- `npm install --cache .npm-cache` succeeds.
- `npm dedupe --cache .npm-cache` succeeds.
- `npx @tamagui/cli check` reports `Tamagui dependencies look good`.
- `npm run lint` passes.
- `npm run build` passes.
- Android Metro bundles `expo-router/entry` without Expo Router, `expo-linking`, or Tamagui config errors.
- Expo Go reached the Finance AI conversation list screen during Android verification.

### Notes

- No backend, Prisma schema, AI orchestration, database, or accounting logic was changed.
- Final Android thread/send screenshot capture could not be completed because the available emulator began routing Expo development URLs to Google Search and adb input intermittently hung.
- A non-fatal Tamagui missing-token warning for `$gray5` remains visible in Android logs, while Tamagui dependency checks pass.

## 0.1.0 - 2026-07-08

### Added

- Created the `finance-ai` monorepo foundation.
- Added Expo React Native mobile app with Tamagui, Zustand, and shared package wiring.
- Added NestJS backend with configuration, health endpoint, Prisma service, and feature module boundaries.
- Added PostgreSQL Prisma schema and client generation script.
- Added shared packages for UI primitives, typed contracts, reusable utilities, and app configuration.
- Added strict TypeScript setup with path aliases across workspaces.
- Added ESLint, Prettier, Husky, lint-staged, EditorConfig, and environment example.
- Added project-management and architecture documentation.
- Added `PRODUCT_SPEC.md` as the single source of truth for the AI-first accounting assistant vision.
- Added `AI_CONTRACT.md` as the official contract for supported intents, entity extraction, tool definitions, structured outputs, confidence scoring, conversation memory, error handling, prompt building, safety rules, streaming, and versioning.
- Implemented the first frontend-only Chat UI experience with Expo Router.
- Added conversation list and chat thread routes as the primary mobile app surface.
- Added local Zustand chat state for conversations, messages, drafts, typing, streaming, retry, and settings.
- Added Tamagui chat components for message bubbles, composer, suggested prompts, typing indicator, streaming state, retry UI, settings sheet, empty states, and conversation cards.
- Added local mock accounting-specific assistant responses with no backend, AI provider, or database calls.
- Added UI-only voice input and attachment placeholder buttons.
- Fixed Expo Router Metro runtime failure for missing `expo-router/assets/logotype.png`.
- Fixed Expo Router Metro runtime failure for missing `expo-linking`.
- Added Expo Router peer dependencies to the mobile workspace dependency list.
- Updated Metro monorepo resolution so the mobile app resolves packages from the root workspace `node_modules`.
- Added root-level `expo-asset@~11.0.5` so Metro's root asset worker can resolve Expo asset plugins.
- Verified Metro starts with a cleared cache without Router asset or `expo-linking` errors.
- Verified Android Metro export succeeds for `expo-router/entry`.
