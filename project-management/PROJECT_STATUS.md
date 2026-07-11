# Project Status

## Current Phase

Foundation initialization, Chat UI Sprint 1, CI, authentication, tenant-aware authorization, the first tenant-scoped accounting data foundation, Chart of Accounts foundation, JournalEntry / JournalLine storage foundation, Posting Service contract design, Posting Preview Builder, Core Posting Service Phase 2, Payment Posting Phase 3, ADJUSTMENT posting design, and ADJUSTMENT line/preview foundation are in place. The accounting engine boundary remains active for unsupported workflows: transaction records start as transaction-intent records, and `Transaction.status = POSTED` is ledger-trustworthy only when produced by the approved posting endpoint with a matching posted `JournalEntry` and balanced `JournalLine` records.

Latest ADJUSTMENT line/preview update: `TransactionAdjustmentLine` schema and `Transaction.adjustmentReason` were added in migration `20260711161000_add_adjustment_lines`. The backend now exposes tenant-scoped `GET`/`PUT /businesses/:businessId/transactions/:transactionId/adjustment-lines` and `POST /businesses/:businessId/transactions/:transactionId/adjustment-preview` behind JWT auth, ACTIVE business membership, and dedicated adjustment permissions. The service stores explicit debit/credit adjustment intent lines for DRAFT ADJUSTMENT transactions, validates same-business active accounts, rejects invalid debit/credit combinations, returns sensitive-account warnings, and builds preview-only lines without creating `JournalEntry`, creating `JournalLine`, or updating `Transaction.status`. Docker/PostgreSQL was restored, Prisma migration `20260711161000_add_adjustment_lines` is applied with clean migration status, live backend smoke passed, and direct database inspection confirmed no ledger persistence from preview. ADJUSTMENT line schema + preview foundation is approved. ADJUSTMENT posting remains blocked; no reversals, inventory movements, sale COGS posting, audit logs, accounting periods, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile adjustment UI were added.

Latest adjustment posting design update: `ADJUSTMENT_POSTING_DESIGN.md` was created as the source of truth for future safe ADJUSTMENT preview and posting. The design requires explicit debit and credit account selection, a required reason, balanced lines, same-business active account validation, safe errors, AI confirmation boundaries, future dedicated adjustment line storage, and reuse of the idempotent atomic posting pathway once implementation is approved. This was documentation/design only; no Prisma schema, migrations, backend APIs, posting logic, `Transaction.status` behavior, reversals, inventory movements, sale COGS posting, audit logs, accounting periods, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI were implemented.

Latest payment posting update: the existing `POST /businesses/:businessId/transactions/:transactionId/post` endpoint now also supports `CUSTOMER_PAYMENT` and `SUPPLIER_PAYMENT` behind JWT auth, ACTIVE business membership, and `journalEntries.post`. `CUSTOMER_PAYMENT` requires a same-business customer, debits Cash, and credits Accounts Receivable. `SUPPLIER_PAYMENT` requires a same-business supplier, debits Accounts Payable, and credits Cash. Payment posting reuses the same tenant-scoped idempotency behavior and atomic JournalEntry + JournalLine + `Transaction.status = POSTED` transaction used by sale, expense, and purchase posting. It does not add invoice allocation, AR/AP aging, customer or supplier statement reconciliation, ADJUSTMENT posting, reversals, inventory movements, sale COGS posting, audit logs, accounting periods, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI.

Latest core posting update: the backend exposes `POST /businesses/:businessId/transactions/:transactionId/post` behind JWT auth, ACTIVE business membership, and `journalEntries.post`. Posting is implemented for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`. The service validates DRAFT transaction intents, same-business customer/supplier/product references, required account mappings, mapped account status/type, line totals, positive amounts, currency, generated debit/credit balance, and idempotency before writing. It creates a POSTED `JournalEntry`, creates `JournalLine` records, and updates `Transaction.status` to `POSTED` atomically in one database transaction. It does not add ADJUSTMENT, inventory movements, sale COGS posting, audit logs, accounting periods, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI.

Latest posting preview update: the backend now exposes `GET /businesses/:businessId/transactions/:transactionId/posting-preview` behind JWT auth, ACTIVE business membership, and `postingPreview.read`. The preview builder validates draft transaction intents, same-business customer/supplier/product references, required account mappings, mapped account status/type, line totals, positive amounts, currency, and generated debit/credit balance. It returns non-persisted preview lines, mappings used, totals, warnings, and safe errors for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`; `ADJUSTMENT` is blocked until explicit debit and credit accounts are designed. This did not add full posting, `Transaction.status` updates, posted journal creation, inventory movements, audit logs, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI.

Latest posting architecture update: `POSTING_SERVICE_CONTRACT.md` was created as the source of truth for future posting service responsibilities, non-responsibilities, service contract, safety gates, transaction type rules, account mapping rules, idempotency, atomicity, status transitions, safe errors, future API design, AI tool boundary, future testing plan, implementation phases, and acceptance criteria. This was documentation/design only; no Prisma schema, migrations, backend APIs, posting service logic, `Transaction.status` update logic, inventory movement automation, audit logs, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile ledger UI were implemented.

Latest Journal foundation update: migration `20260710233859_add_journal_foundation` added tenant-scoped `JournalEntry` and `JournalLine` models plus `JournalEntryStatus`. The backend exposes guarded journal read endpoints and a strict draft-only creation endpoint for balanced manual drafts. Internal helpers validate balanced debit/credit lines and same-business active accounts. This is storage/read foundation only; no posting service, automatic transaction posting, `Transaction.status` update logic, inventory movement automation, audit logs, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or polished mobile ledger UI were added.

Latest Chart of Accounts update: migration `20260710231017_add_chart_of_accounts` added tenant-scoped `Account` and `AccountMapping` models plus `AccountType`, `NormalBalance`, and `AccountMappingKey` enums. New default businesses and newly created businesses now receive eight idempotent system accounts and eight default mappings in the same transaction. Guarded account and mapping APIs are available under `/businesses/:businessId/accounts` and `/businesses/:businessId/account-mappings`. A safe local backfill script, `npm run accounts:backfill-defaults --workspace @finance-ai/backend`, seeds default accounts/mappings for existing non-deleted businesses without resetting data.

Latest accounting architecture update: `ACCOUNTING_ENGINE_BOUNDARY.md` was created as the source of truth for how transaction-intent records will later become validated postings, balanced journal entries, inventory movements, auditable events, and safe AI tool results. This was documentation/design only; no Prisma schema, migrations, backend APIs, mobile UI, ledger posting, inventory automation, AI orchestration, chat persistence, reports, PDFs, dashboards, budgets, goals, bank connections, or OCR were implemented.

Latest accounting foundation update: migration `20260710222110_add_accounting_foundation` added tenant-scoped `Customer`, `Supplier`, `Product`, `Transaction`, and `TransactionLine` models plus `TransactionType` and `TransactionStatus` enums. Backend APIs now expose guarded tenant-scoped CRUD foundations for customers, suppliers, products, and transaction-intent records. Transactions do not post to a ledger, update inventory, call AI tools, persist chat, generate reports, export PDFs, or implement dashboards, budgets, goals, bank connections, or OCR.

Latest tenancy update: migration `20260710151650_add_tenancy_foundation` added `Business`, `BusinessMember`, `BusinessRole`, and `BusinessMemberStatus`. Registration now creates a default business and ACTIVE OWNER membership in a transaction. The backend exposes basic business endpoints with membership/role authorization, and the mobile app has a SecureStore-backed active business state foundation.

Latest authentication QA update: Authentication Foundation is approved on the rebooted `Pixel_9_API_35` Android emulator. Local PostgreSQL runs through Docker Compose, Prisma migration `20260709234821_init_auth` is applied against `smartaccountant_dev`, backend auth smoke tests passed, and Android mobile QA verified register, logout, invalid login, valid login, session restore, duplicate registration, and authenticated Chat UI routing against the live backend at `http://10.0.2.2:3000`.

The latest work completed Android visual QA for Chat UI Sprint 1. The QA flow now waits for real UI text before capturing screenshots, retries past Expo Go loading states, and stores reviewed screenshot evidence under `project-management/screenshots/chat-ui`. Chat UI Sprint 1 is approved.

Repository layout maintenance is also complete: the project files were moved out of the nested `finance-ai/` folder, so the GitHub repository root is now the npm workspace root.

The latest stabilization work added focused Vitest coverage for the local Zustand chat store and created `CHAT_AI_BOUNDARY.md` to define the future contract between the Chat UI and AI Orchestrator.

CI tooling is now in place through GitHub Actions. The `CI` workflow runs on pushes and pull requests to `main` and validates install, Prisma schema/client generation, lint, build, and tests from the repository root.

Authentication foundation implementation is complete for this phase. Backend auth module, Prisma auth schema, hashed password storage, hashed refresh-token rotation, JWT access tokens, auth guards, DTO validation, mobile login/register screens, SecureStore token persistence, session restore, route guard, logout, focused auth tests, and Android mobile auth QA are complete. Local PostgreSQL is available through Docker Compose and backend auth endpoints are live-verified.

Latest routing fix: the Expo Router root-layout navigation error after adding authentication was fixed by removing redirect logic from `apps/mobile/app/_layout.tsx`. The root layout now mounts the root `Stack` immediately, while authenticated and guest route guards run inside route screens after the navigator exists.

## Completed

- Created the `finance-ai` npm workspaces monorepo.
- Flattened the repository layout so `apps/`, `packages/`, `project-management/`, `docs/`, and root tooling files live directly at the GitHub repository root.
- Added Expo React Native app under `apps/mobile`.
- Added NestJS backend under `apps/backend`.
- Added Prisma configuration for PostgreSQL.
- Added shared packages for UI, shared types, utilities, and app configuration.
- Added strict TypeScript configuration and path aliases.
- Added ESLint, Prettier, Husky, lint-staged, EditorConfig, and environment example files.
- Added scalable feature-based folders for mobile and backend.
- Added project-management documentation set.
- Added `PRODUCT_SPEC.md` and `AI_CONTRACT.md` for the AI-first accounting product direction.
- Added `CHAT_AI_BOUNDARY.md` to define the future Chat UI and AI Orchestrator integration boundary.
- Added GitHub Actions CI for root workspace validation on pushes and pull requests to `main`.
- Added backend authentication foundation with register, login, refresh, logout, and current-user endpoints.
- Added Prisma `User`, `RefreshToken`, and `UserRole` auth schema.
- Added bcrypt password hashing, hashed refresh-token storage, JWT access tokens, refresh-token rotation, auth guard, DTO validation, and environment validation.
- Added mobile authentication foundation with login/register screens, auth Zustand store, Expo SecureStore token storage, API auth client, session restore, route guard, and logout.
- Added focused backend and mobile auth tests.
- Added `TENANCY_AUTHORIZATION.md` to define the future business/tenant model, membership model, role permissions, data isolation rules, backend authorization strategy, mobile active business behavior, AI tool authorization rules, security risks, and implementation phases.
- Added tenant-aware authorization foundation with `Business` and `BusinessMember` Prisma models, business roles, membership statuses, default business creation on register, business endpoints, membership guard, role decorator, active-business endpoint, mobile business API, active-business Zustand store, SecureStore active business id persistence, and focused tests.
- Added tenant-scoped accounting data foundation with `Customer`, `Supplier`, `Product`, `Transaction`, and `TransactionLine` Prisma models.
- Added guarded backend endpoints for tenant-scoped customers, suppliers, products, and transactions.
- Added accounting permissions for customer, supplier, product, and transaction read/manage/create/update/void actions.
- Added minimal mobile accounting response types and read-only API methods.
- Added `ACCOUNTING_ENGINE_BOUNDARY.md` to define future chart of accounts, journal entry, journal line, inventory movement, audit log, posting lifecycle, idempotency, reversal, tenant isolation, permissions, AI tool, validation, and error-handling boundaries.
- Added Chart of Accounts foundation with tenant-scoped `Account` and `AccountMapping` Prisma models.
- Added `AccountType`, `NormalBalance`, and `AccountMappingKey` Prisma enums.
- Added default system accounts for Cash, Accounts Receivable, Inventory Asset, Accounts Payable, Owner Equity, Sales Revenue, Cost of Goods Sold, and General Expense.
- Added default account mappings for future posting configuration without implementing posting.
- Added guarded tenant-scoped account and account-mapping endpoints.
- Added account permissions for read/manage accounts and read/manage account mappings.
- Added safe idempotent default-account backfill script for existing local businesses.
- Added minimal mobile account and account-mapping response types plus read-only API methods.
- Added JournalEntry / JournalLine foundation with tenant-scoped `JournalEntry` and `JournalLine` Prisma models.
- Added `JournalEntryStatus` Prisma enum.
- Added guarded tenant-scoped journal entry read endpoints and strict draft-only creation endpoint.
- Added journal permissions for read, manage, create draft, post, and void; post/void are future-use permissions only in this phase.
- Added internal validation helpers for balanced journal lines, totals, and same-business active account validation.
- Added minimal mobile journal entry and journal line response types plus read-only API methods.
- Added `POSTING_SERVICE_CONTRACT.md` to define the future posting service contract and safety gates.
- Added the Posting Preview Builder for read-only, non-persisted journal previews from draft transaction intents.
- Added `GET /businesses/:businessId/transactions/:transactionId/posting-preview`.
- Added `postingPreview.read`, allowed for OWNER, ADMIN, and ACCOUNTANT only.
- Added safe preview support for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`.
- Added safe `ADJUSTMENT` rejection until explicit debit and credit account selection exists.
- Added minimal mobile posting preview response types and read-only API method.
- Added Core Posting Service Phase 2 for `SALE`, `EXPENSE`, and `PURCHASE`.
- Added `POST /businesses/:businessId/transactions/:transactionId/post`.
- Reused `journalEntries.post` for the posting permission.
- Added idempotent posting with the existing tenant-scoped `JournalEntry` idempotency key.
- Added minimal mobile post transaction response types and API method.
- Added Payment Posting Phase 3 for `CUSTOMER_PAYMENT` and `SUPPLIER_PAYMENT`.
- Reused the existing posting endpoint, `journalEntries.post` permission, idempotency behavior, and atomic journal/status update behavior for payment posting.
- Added focused payment posting tests for Cash/AR and AP/Cash journal lines, required customer/supplier references, same-business party validation, mapping validation, idempotency, duplicate prevention, permissions, and no inventory/audit behavior.
- Added `ADJUSTMENT_POSTING_DESIGN.md` as the source-of-truth design for future safe ADJUSTMENT preview and posting.
- Documented the recommended future `TransactionAdjustmentLine` storage approach instead of overloading product-oriented `TransactionLine`.
- Documented future adjustment preview behavior, posting behavior, permissions, safety gates, safe errors, AI boundaries, testing plan, implementation phases, and acceptance criteria.
- Added `TransactionAdjustmentLine` schema and `Transaction.adjustmentReason` for explicit adjustment intent storage.
- Added migration `20260711161000_add_adjustment_lines`.
- Added dedicated `adjustments.read`, `adjustments.manage`, and `adjustments.preview` permissions for OWNER, ADMIN, and ACCOUNTANT.
- Added guarded adjustment line endpoints for reading and replacing stored lines on DRAFT ADJUSTMENT transactions.
- Added guarded ADJUSTMENT preview endpoint that returns balanced preview-only lines and sensitive-account warnings.
- Added minimal mobile adjustment line and adjustment preview types plus API methods.
- Defined future posting service responsibilities, non-responsibilities, service method contract, safety gates, transaction type posting rules, account mapping rules, idempotency rules, atomicity rules, status transition rules, validation rules, safe errors, future API design, AI tool boundary, testing plan, implementation phases, and acceptance criteria.
- Fixed the Expo Router auth route guard so root layout no longer navigates before mounting the root navigator.
- Added Docker Compose local PostgreSQL service for `smartaccountant_dev`.
- Created and applied Prisma migration `20260709234821_init_auth`.
- Created and applied Prisma migration `20260710151650_add_tenancy_foundation`.
- Created and applied Prisma migration `20260710222110_add_accounting_foundation`.
- Implemented the frontend-only Chat UI as the primary mobile app surface.
- Added Expo Router routes for the conversation list and chat thread.
- Added local Zustand chat state for conversations, messages, drafts, typing, streaming, retry, and settings.
- Added focused Vitest tests for local chat store behavior, including initial state, conversation creation, active conversation changes, sending, typing/streaming, local mock responses, suggested prompt draft flow, error/retry, local clear confirmation, and message ordering.
- Added a safe Prisma schema validation script for CI.
- Fixed Expo Router Metro runtime errors for `expo-router/assets/logotype.png` and `expo-linking`.
- Fixed root Metro asset worker resolution by adding root-level `expo-asset`.
- Fixed the Tamagui runtime configuration error by adding an app-local `apps/mobile/tamagui.config.ts` and wiring it directly into the Expo root layout.
- Aligned Tamagui dependencies to exact `1.144.4` versions across mobile, UI, and config workspaces.
- Added `react-dom@18.3.1` and `react-native-web@~0.19.13` so Tamagui and Expo-compatible tooling can load the config cleanly.
- Replaced the mobile chat composer Tamagui `TextArea` with React Native `TextInput` after Android exposed a runtime render failure inside `TextArea`.
- Fixed assistant chat bubble width so Markdown content does not collapse into a narrow column.
- Refined the conversation list header copy so it no longer clips on Android.
- Reduced the `Finance AI` screen title size to feel more like an app screen than a landing page.
- Improved search and New button alignment, height, and proportions.
- Softened conversation card borders, spacing, pressed state, and text wrapping.
- Replaced `$gray5` border token usage with `$gray6` in the chat header and composer to remove the missing-token warning source.
- Added clearer accessibility labels for disabled settings placeholders.
- Updated local mock assistant and empty-state copy to avoid saying records were saved, recorded, or created.
- Downloaded the SDK 52 recommended Expo Go APK through Expo CLI and reinstalled Expo Go on the emulator.
- Added Android QA runner scripts with longer waits, UI text readiness checks, screenshot retries, and focused clear/retry/dark-mode flows.
- Captured and reviewed Chat UI Sprint 1 screenshots on the `Pixel_9_API_35` Android emulator.
- Fixed a settings sheet native runtime crash by removing Tamagui CSS animation props from the native settings sheet.
- Verified `npx @tamagui/cli check` passes.
- Verified `npm run lint` passes.
- Verified `npm run build` passes.
- Verified Android Metro can bundle `expo-router/entry` without Expo Router, `expo-linking`, or Tamagui config errors.

## Latest Authentication QA Finding

Android auth QA is approved on the rebooted `Pixel_9_API_35` emulator through Expo Go and Metro on `localhost:8081`. The mobile app used `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` and verified against the live NestJS backend backed by Docker PostgreSQL.

Verified Android mobile flows:

- Unauthenticated launch shows login.
- Register screen opens.
- Registering `mobileqa@example.com` succeeds against the live backend.
- The authenticated user reaches the Chat UI.
- Logout clears the local session and returns to login.
- Invalid login shows `Invalid email or password.` without crashing.
- Valid login succeeds against the live backend.
- Force-stop/relaunch restores the session and lands on the authenticated Chat UI.
- Duplicate registration shows `An account with this email already exists.` without crashing.

Captured auth QA screenshots are stored under `project-management/screenshots/auth-qa/`:

- `01-login.png`
- `02-register.png`
- `03-authenticated-chat-ui.png`
- `04-invalid-login-error.png`
- `05-duplicate-registration-error.png`
- `06-logout-returned-to-login.png`
- `07-session-restore-chat-ui.png`
- `auth-launch-monkey.png` from the earlier transport-failure investigation

Expo Go still reports `versionName=2.32.19` after installing the cached SDK 52 APK named `Expo-Go-2.32.20.apk`, but this did not block the approved rebooted-emulator QA run. The Expo development-build fallback remains prepared with `expo-dev-client`, but it was not needed for final approval.

## Latest Chat UI QA Finding

The Chat UI renders and the app flow works on Android through Expo Go. The earlier QA issue was automation timing on a slow emulator, not a functional UI render failure. Short waits could capture Expo Go's loading or bundling overlay even after Metro had finished and the app was about to paint the real UI.

The improved QA flow waits for real UI text or selectors such as `Finance AI`, conversation card text, `Message composer`, `Chat Settings`, and `Retry` before taking stable screenshots. It captures the transient typing/streaming state with a short timed screenshot after send because that state is intentionally brief. The required conversation list, chat thread, send flow, typing/streaming, settings sheet, retry UI, dark mode, and clear-conversation screenshots were captured and reviewed.

During final functional verification, clearing a conversation exposed a native red-screen error: `node.addEventListener is not a function`. Root cause was Tamagui CSS animation props on the native settings sheet overlay and switch thumbs. Removing those animation props fixed the native crash; clear conversation now shows the local-only clear message without backend changes.

## Previous Runtime Root Cause

The mobile app did not have a canonical app-local Tamagui config. The active Expo Router layout imported a config through shared package indirection, while Tamagui package specs were loose and mixed across workspaces. That allowed duplicate or mismatched Tamagui resolution in Metro and caused Tamagui components to render without a recognized provider config.

Secondary issues found during validation:

- `react-dom` and `react-native-web` were missing for config/tooling paths that load Tamagui outside the native runtime.
- Duplicate nested Tamagui packages were present before `npm dedupe`.
- Android rendering exposed a Tamagui `TextArea` crash in `ChatComposer`.
- Assistant Markdown bubbles needed an explicit width on Android to avoid text collapsing.

## Changed Files

- `apps/mobile/tamagui.config.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/src/application/App.tsx`
- `apps/mobile/src/theme/index.ts`
- `apps/mobile/src/theme/tamagui.d.ts`
- `apps/mobile/src/features/chat/components/ChatBubble.tsx`
- `apps/mobile/src/features/chat/components/ChatComposer.tsx`
- `apps/mobile/src/features/chat/components/ChatEmptyState.tsx`
- `apps/mobile/src/features/chat/components/ChatHeader.tsx`
- `apps/mobile/src/features/chat/components/ChatSettingsSheet.tsx`
- `apps/mobile/src/features/chat/components/ConversationCard.tsx`
- `apps/mobile/src/features/chat/data/mock-chat-data.ts`
- `apps/mobile/src/features/chat/screens/ConversationListScreen.tsx`
- `apps/mobile/src/features/chat/utils/message-formatters.ts`
- `project-management/android-chat-qa.ps1`
- `project-management/android-chat-qa-retry-dark.ps1`
- `project-management/android-chat-qa-clear.ps1`
- `project-management/screenshots/chat-ui/*.png`
- `apps/mobile/package.json`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/ui/package.json`
- `package-lock.json`
- `README.md`
- `apps/mobile/src/features/chat/store/chat.store.test.ts`
- `.github/workflows/ci.yml`
- `apps/backend/package.json`
- `.env.example`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/app/app.module.ts`
- `apps/backend/src/config/app.config.ts`
- `apps/backend/src/features/auth/**`
- `apps/mobile/app/auth/**`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/app/index.tsx`
- `apps/mobile/app/chat/[conversationId].tsx`
- `apps/mobile/src/features/auth/components/AuthRouteGuards.tsx`
- `apps/mobile/src/features/auth/**`
- `apps/mobile/src/features/chat/components/ChatHeader.tsx`
- `apps/mobile/src/features/chat/screens/ConversationListScreen.tsx`
- `vitest.config.ts`
- `project-management/CHAT_AI_BOUNDARY.md`
- `project-management/PROJECT_STATUS.md`
- `project-management/TASKS.md`
- `project-management/CHANGELOG.md`

## Verification

- `npm install --cache .npm-cache`: passing.
- `npm dedupe --cache .npm-cache`: passing.
- `node -e "require('./apps/mobile/tamagui.config.ts')"`: passing.
- `npx @tamagui/cli check`: passing with `Tamagui dependencies look good`.
- `npm run lint`: passing.
- `npm run build`: passing.
- `npm run test`: passing, 3 Vitest files and 17 tests.
- `npm run prisma:validate`: passing with dummy CI `DATABASE_URL`.
- `npm run prisma:generate`: passing with dummy CI `DATABASE_URL`.
- GitHub Actions CI for commit `4e57a1634d3d12707510b9a2d60751a8dfdef7f4`: green before auth implementation began.
- `docker compose up -d postgres`: passing; PostgreSQL `smartaccountant_dev` accepts connections on `localhost:5432`.
- Prisma migration `20260709234821_init_auth`: created and applied successfully.
- Backend live auth smoke tests: passing for register, login, `/auth/me`, refresh rotation, logout, old refresh-token reuse rejection, duplicate registration rejection, and wrong-password rejection. API responses return safe user objects without `passwordHash`.
- Refresh-token database check: passing; stored token hashes are SHA-256 hex strings and rotated/logout tokens are revoked.
- Android auth routing verification on `Pixel_9_API_35`: Expo Go launched, `Running "main"` appeared in logs, unauthenticated launch rendered the login screen, and no `Attempted to navigate before mounting the Root Layout component` error appeared.
- `npx expo export --platform android --output-dir .expo-export-check`: passing after rerun outside sandbox to allow the Hermes compiler executable.
- GitHub Actions workflow syntax was reviewed by inspection; the workflow will be fully verified by GitHub after push.
- `npx expo export --platform android --output-dir .expo-export-check`: passing.
- Source search for `$gray5`: no remaining matches in `apps/mobile/src` or `packages`.
- Android launch after Expo CLI reinstall: Metro bundles `expo-router/entry` successfully and the Chat UI renders in Expo Go.
- Android visual verification: approved on `Pixel_9_API_35` with selector-based waits and reviewed screenshots.
- Clear conversation: passing after removing native-unsafe settings sheet animation props.
- Android mobile auth QA on `Pixel_9_API_35`: passing for register, logout, login, session restore, invalid login, duplicate registration, and authenticated Chat UI routing against `http://10.0.2.2:3000`.
- `npm run test`: passing with 6 Vitest files and 31 tests after tenancy implementation.
- Prisma migration `20260710151650_add_tenancy_foundation`: created and applied successfully.
- Tenancy smoke test: passing for new user registration, default business creation, ACTIVE OWNER membership creation, `GET /businesses`, `GET /businesses/active`, owner access to own business, and 403 denial when a second user guesses another business id.
- `npm run test`: passing with 10 Vitest files and 48 tests after accounting foundation implementation.
- Prisma migration `20260710222110_add_accounting_foundation`: created and applied successfully.
- Accounting smoke test: passing for registering user A, creating customer, supplier, product, and sale transaction under business A, registering user B, denying user B guessed customer/product/transaction access with 403, listing records only for business A, and voiding the transaction as an authorized owner.
- Accounting engine boundary design: complete as documentation only; no executable accounting engine implementation was added.
- Prisma migration `20260710231017_add_chart_of_accounts`: created and applied successfully.
- Chart of Accounts tests: passing with 12 Vitest files and 65 tests.
- Chart of Accounts smoke test: passing for registering user A, confirming 8 default accounts and 8 mappings, creating a custom expense account, registering user B, denying user B access to business A accounts with 403, confirming user B has independent default account code `1000`, rejecting system-account deletion with 403, and soft-deleting the custom account so it is excluded from normal lists.
- Default-account backfill: passing for 7 existing non-deleted local businesses using idempotent upserts.
- Prisma migration `20260710233859_add_journal_foundation`: created and applied successfully.
- Journal foundation tests: passing with 15 Vitest files and 86 tests.
- Journal foundation smoke test: passing for registering user A, confirming default accounts, creating a balanced draft journal entry using Cash and Owner Equity, reading journal list/detail with lines, registering user B, denying user B guessed access to business A journal detail with 403, and rejecting unbalanced draft creation with 400.
- Journal boundary verification: source search confirms no journal module `transaction.update` logic or automatic `Transaction.status` mutation was added.
- Posting service contract design: originally completed as documentation only; Core Posting Service Phase 2 has now implemented the approved narrow SALE, EXPENSE, and PURCHASE pathway.
- Posting Preview Builder tests: passing with 17 Vitest files and 105 tests.
- Posting Preview Builder smoke test: passing for user A registration, default mappings count 8, draft sale creation, balanced preview `200.00` debit and credit, zero journal entries before and after preview, unchanged transaction status `DRAFT`, user B cross-tenant denial with 403, safe `ADJUSTMENT` rejection, and safe `MISSING_ACCOUNT_MAPPING` after deleting the smoke business CASH mapping. Tokens were masked.
- Posting preview no-persistence verification: no `JournalEntry` was created, no `JournalLine` was created, `Transaction.status` stayed `DRAFT`, product quantity was not changed by preview logic, and no InventoryMovement or AuditLog tables exist or equivalent behavior was added.
- Core Posting Service Phase 2 tests: passing with 18 Vitest files and 124 tests.
- Core Posting Service smoke test: passing for registering user A, confirming 8 mappings, posting a DRAFT sale, confirming POSTED journal and balanced lines, confirming `Transaction.status` changed to `POSTED`, retrying the same idempotency key without duplicate journals, rejecting a second idempotency key for the already posted transaction with 409, denying user B with 403, posting a DRAFT expense, posting a DRAFT purchase, confirming product quantity stayed unchanged, and safely rejecting CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, and ADJUSTMENT with 400. Tokens were masked.
- Payment Posting Phase 3 tests: passing with focused coverage for `CUSTOMER_PAYMENT` Cash debit / Accounts Receivable credit, required customer, cross-tenant customer rejection, required Cash and Accounts Receivable mappings, wrong account type rejection, `SUPPLIER_PAYMENT` Accounts Payable debit / Cash credit, required supplier, cross-tenant supplier rejection, required Accounts Payable and Cash mappings, idempotent retry, duplicate payment prevention, `ADJUSTMENT` still blocked, product quantity unchanged, and no InventoryMovement or AuditLog behavior.
- Payment Posting Phase 3 smoke test: passing for registering user A, confirming 8 mappings, creating a customer, creating a supplier, creating a product with quantity 7, posting a DRAFT `CUSTOMER_PAYMENT`, confirming Cash debit and Accounts Receivable credit, confirming `Transaction.status = POSTED`, retrying the same idempotency key with the same journal, confirming product quantity stayed 7, posting a DRAFT `SUPPLIER_PAYMENT`, confirming Accounts Payable debit and Cash credit, registering user B, denying user B with 403, and safely rejecting `ADJUSTMENT` with 400. Tokens were masked.
- ADJUSTMENT posting design: complete as documentation only. The design confirms the current `TransactionLine` model cannot store explicit adjustment account debit/credit lines and recommends future dedicated `TransactionAdjustmentLine` storage before implementing ADJUSTMENT preview/posting.
- ADJUSTMENT line/preview tests: passing with focused coverage for valid two-line and multi-line storage, tenant-scoped line reads, cross-tenant transaction denial, invalid debit/credit combinations, cross-tenant/inactive/deleted account rejection, non-ADJUSTMENT rejection, non-DRAFT rejection, preview balance, sensitive-account warnings, no JournalEntry creation, no JournalLine creation, no Transaction.status update, no product quantity update, no InventoryMovement behavior, no AuditLog behavior, adjustment permission denial, and existing ADJUSTMENT posting rejection.
- Docker/PostgreSQL was restored with `docker compose up -d postgres`; `smartaccountant_dev` is reachable on `localhost:5432`.
- Migration `20260711161000_add_adjustment_lines` is applied. `npx.cmd prisma migrate deploy --schema apps/backend/prisma/schema.prisma` reports no pending migrations, and `npx.cmd prisma migrate status --schema apps/backend/prisma/schema.prisma` reports the database schema is up to date.
- Final validation after ADJUSTMENT line/preview foundation: `npm.cmd run lint` passed, `npm.cmd run build` passed, `npm.cmd run test` passed with 19 files and 139 tests, `npm.cmd run prisma:validate` passed, and `npm.cmd run prisma:generate` passed.
- ADJUSTMENT live smoke test passed against the running NestJS backend and Docker PostgreSQL: user A registered, default business/accounts existed, a DRAFT ADJUSTMENT transaction was created, Cash debit and Owner Equity credit lines were saved/read, preview returned `totalDebit = 100.00`, `totalCredit = 100.00`, `isBalanced = true`, and sensitive-account warnings, while `JournalEntry` count stayed 0, `JournalLine` count stayed 0, `Transaction.status` stayed `DRAFT`, product quantity stayed `7`, the normal posting endpoint still rejected ADJUSTMENT with 400, user B cross-tenant reads/writes/previews were denied with 403, and unbalanced lines were rejected with 400.
- Direct database inspection passed: `TransactionAdjustmentLine` table exists, `Transaction.adjustmentReason` column exists, the two adjustment lines reference the smoke business and transaction, no journal entries or lines were created for the previewed adjustment, the transaction remained `DRAFT`, and no `InventoryMovement` or `AuditLog` tables exist.

## Known Limitations

- Chat responses are local mock responses only.
- No email verification, forgot/reset password, social login, organization/team membership, production secrets, or deployment environment exists yet.
- Tenant-aware authorization foundation is implemented, but there is no full email invitation flow, no member removal endpoint, and no polished mobile business switcher yet.
- Accounting data foundation is implemented, but there is no double-entry ledger, finalized accounting engine, automatic inventory movement engine, tenant-scoped AI tool execution, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or polished mobile CRUD screens yet.
- Chart of Accounts foundation is implemented, but accounts and mappings are configuration only. They do not post transactions, create journal entries or journal lines, update inventory, power reports, or execute AI tools yet.
- JournalEntry / JournalLine foundation is implemented, but draft journals are not a posting workflow. The system still has no posting service, automatic transaction status update, inventory movement automation, audit logs, reports, or AI tool execution.
- Posting is implemented only for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`.
- ADJUSTMENT posting is not implemented yet.
- ADJUSTMENT posting remains blocked; only line storage and preview foundation are implemented and approved.
- Customer and supplier payment posting uses general AR/AP mappings only; there is no invoice-level allocation, AR/AP aging, customer statement reconciliation, or supplier statement reconciliation yet.
- Inventory movements are not implemented; purchase product lines return a warning and do not update product quantity.
- Sale COGS and inventory asset reduction are not implemented; sale product lines return a warning.
- No audit logs, accounting periods, AI tool execution, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, or mobile posting UI exist yet.
- The current schema can enforce tenant-scoped idempotency by `businessId + idempotencyKey` and reject key reuse for another transaction, but it does not store a full posting request hash or source enum yet.
- Historical `Transaction.status = POSTED` intent records without a matching posted journal entry still require reconciliation and are not treated as ledger truth.
- Chat store tests cover local Zustand logic only; React Native component and emulator flows remain covered by manual/visual QA, not automated UI tests.
- The Chat/AI boundary is documentation only; no backend endpoint, AI provider call, tool execution, or persistence layer was implemented.
- CI does not run Android emulator, Expo Go, backend services, migrations, AI providers, or a real database connection.
- Voice input button is UI-only and does not request permissions or record audio.
- Attachment button is a UI placeholder and does not open a file picker.
- Chat settings are local UI controls only; only clearing the current conversation changes local state.
- Chat messages are not connected to backend persistence, AI provider calls, tool calling, Prisma accounting models, or accounting logic.
- The available Android emulator is slow. Future QA should keep the longer explicit waits, UI text readiness checks, and overlay retry logic.
- Expo Go still reports `2.32.19` even after the SDK 52 `Expo-Go-2.32.20.apk` reinstall attempt, but this did not block the final approved auth and Chat UI QA runs.
- The `$gray5` warning source was removed from the app source. Latest Android logs from the offline launch do not show the `$gray5` warning.
- Expo CLI dependency validation can fail in this environment with `TypeError: Body is unusable: Body has already been read`; Android verification used `EXPO_NO_DEPENDENCY_VALIDATION=1`.

## Scope Guardrails

Next recommended task: if separately approved, implement the future ADJUSTMENT posting pathway from `ADJUSTMENT_POSTING_DESIGN.md` using the existing accounting engine boundary. Keep reversals, inventory movement automation, sale COGS posting, audit logs, accounting periods, AI orchestration implementation, reports, PDFs, dashboards, budgets, goals, bank connections, OCR, and production deployment automation out of scope unless separately approved.
