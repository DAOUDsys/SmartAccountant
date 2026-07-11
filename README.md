# Finance AI

Finance AI is a TypeScript-first monorepo foundation for a production-grade AI accounting product. The repository includes the mobile app, NestJS backend, shared packages, local PostgreSQL setup, Prisma, authentication, tenant-aware authorization, tenant-scoped accounting foundations, Chart of Accounts configuration, JournalEntry / JournalLine storage foundation, and project-management documentation.

## Architecture

The repository uses npm workspaces and separates deployable apps from reusable packages:

- `apps/mobile` is an Expo React Native application using Tamagui for interface primitives, Zustand for client state, and Victory Native XL dependencies for future financial charts.
- `apps/backend` is a NestJS API with PostgreSQL configured through Prisma.
- `packages/ui` contains shared Tamagui-based UI primitives for mobile-first product surfaces.
- `packages/shared-types` contains serializable TypeScript contracts that can be shared across apps.
- `packages/utils` contains framework-neutral helpers.
- `packages/config` contains shared configuration, including the Tamagui config.
- `project-management` captures delivery state, roadmap, tasks, architecture, API, database, AI, and UI decisions.
- `docs` contains supporting engineering documentation.

## Setup

Install dependencies from the monorepo root:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start the local PostgreSQL database:

```bash
docker compose up -d postgres
```

Set secure local values for the authentication secrets in `.env` before starting the backend:

```bash
JWT_ACCESS_SECRET="use-a-long-random-local-secret"
JWT_REFRESH_SECRET="use-a-different-long-random-local-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"
BCRYPT_ROUNDS=12
```

For Android emulator QA, set the mobile API URL to the host loopback bridge:

```bash
EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"
```

For backend and Prisma commands on the host machine, use:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartaccountant_dev?schema=public"
```

Generate the Prisma client:

```bash
npm run prisma:generate
```

Apply local database migrations. The current local migration history includes `20260709234821_init_auth`, `20260710151650_add_tenancy_foundation`, `20260710222110_add_accounting_foundation`, `20260710231017_add_chart_of_accounts`, and `20260710233859_add_journal_foundation`:

```bash
npx prisma migrate dev --schema apps/backend/prisma/schema.prisma
```

For existing local development businesses created before Chart of Accounts, backfill default account configuration with idempotent upserts:

```bash
npm run accounts:backfill-defaults --workspace @finance-ai/backend
```

Run the backend:

```bash
npm run dev:backend
```

Run the mobile app:

```bash
npm run dev:mobile
```

Run both development servers:

```bash
npm run dev
```

## Scripts

- `npm run build` builds shared packages, builds the NestJS backend, and type-checks the Expo app.
- `npm run typecheck` runs TypeScript checks across workspaces.
- `npm run lint` runs ESLint across the monorepo.
- `npm run test` runs the Vitest logic test suite.
- `npm run format` formats source and documentation with Prettier.
- `npm run format:check` verifies formatting.
- `npm run prisma:validate` validates the Prisma schema without running migrations.
- `npm run prisma:generate` generates Prisma Client from `apps/backend/prisma/schema.prisma`.
- `npm run accounts:backfill-defaults --workspace @finance-ai/backend` creates missing default system accounts and mappings for existing businesses without resetting data.

## Authentication

The backend exposes an authentication foundation at `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, and `/auth/me`. Passwords are hashed with bcrypt and refresh tokens are stored only as hashes.

Registration creates a default business and ACTIVE OWNER membership in one transaction, then returns the user, token pair, and default business context.

The mobile app includes login and registration screens, restores sessions on launch, stores tokens with Expo SecureStore, and gates the approved Chat UI behind authentication. Configure `EXPO_PUBLIC_API_URL` for the mobile app to point at the backend.

Android emulator auth QA is approved on the rebooted `Pixel_9_API_35` emulator with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`. Expo Go still reports `2.32.19` while Expo SDK 52 recommends `2.32.20`, so future QA should keep the longer waits and UI-text checks used in `project-management/screenshots/auth-qa/`. A prepared fallback is an Expo development build using `expo-dev-client`. To use it locally, install and configure a JDK so `java` and `JAVA_HOME` are available, then run:

```bash
cd apps/mobile
npx expo run:android
```

If using a physical Android device with Expo Go instead, set `EXPO_PUBLIC_API_URL` to the host machine LAN URL rather than `10.0.2.2`.

## Tenancy Authorization

The backend includes the tenant-aware authorization foundation described in `project-management/TENANCY_AUTHORIZATION.md`.

Current business endpoints:

- `GET /businesses` returns businesses where the current user has ACTIVE membership.
- `GET /businesses/active` returns the user's first active/default business context.
- `POST /businesses` creates a business and makes the current user OWNER.
- `GET /businesses/:businessId` returns a business only after ACTIVE membership verification.
- `GET /businesses/:businessId/members` requires OWNER or ADMIN.
- `POST /businesses/:businessId/members` can add an existing user by email with a non-owner role; full invitation email flow is future work.

The mobile app stores `activeBusinessId` in Expo SecureStore, loads businesses after login/session restore, selects the stored or first available business, and clears active business state on logout.

## Accounting Foundation

The backend includes tenant-scoped foundation APIs for customers, suppliers, products, basic transaction-intent records, accounts, account mappings, journal entries, journal lines, read-only posting previews, and the first narrow posting pathway. These endpoints are protected by JWT authentication, ACTIVE business membership, role permissions, and `businessId` route scoping.

Current accounting endpoints:

- `/businesses/:businessId/customers`: `GET`, `GET /:customerId`, `POST`, `PATCH /:customerId`, `DELETE /:customerId`
- `/businesses/:businessId/suppliers`: `GET`, `GET /:supplierId`, `POST`, `PATCH /:supplierId`, `DELETE /:supplierId`
- `/businesses/:businessId/products`: `GET`, `GET /:productId`, `POST`, `PATCH /:productId`, `DELETE /:productId`
- `/businesses/:businessId/transactions`: `GET`, `GET /:transactionId`, `POST`, `PATCH /:transactionId`, `POST /:transactionId/void`
- `/businesses/:businessId/accounts`: `GET`, `GET /:accountId`, `POST`, `PATCH /:accountId`, `DELETE /:accountId`
- `/businesses/:businessId/account-mappings`: `GET`, `PATCH /:key`
- `/businesses/:businessId/journal-entries`: `GET`, `GET /:journalEntryId`, `POST /draft`
- `/businesses/:businessId/transactions/:transactionId/posting-preview`: `GET`
- `/businesses/:businessId/transactions/:transactionId/adjustment-lines`: `GET`, `PUT`
- `/businesses/:businessId/transactions/:transactionId/adjustment-preview`: `POST`
- `/businesses/:businessId/transactions/:transactionId/post`: `POST`

New businesses receive default system accounts for Cash, Accounts Receivable, Inventory Asset, Accounts Payable, Owner Equity, Sales Revenue, Cost of Goods Sold, and General Expense. Default mappings connect future posting configuration keys to those accounts.

Posting previews validate draft transaction intents, required account mappings, same-business references, and hypothetical debit/credit balance for `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`. `ADJUSTMENT` previews are blocked until explicit debit and credit accounts are designed. The preview endpoint requires `postingPreview.read` and returns `canPost`, preview lines, mappings used, warnings, and errors without creating journals.

Adjustment line storage is available for future-safe ADJUSTMENT workflows. `PUT /businesses/:businessId/transactions/:transactionId/adjustment-lines` replaces explicit debit/credit adjustment lines for a DRAFT ADJUSTMENT transaction, stores `adjustmentReason`, and validates same-business active accounts plus balanced debit/credit totals. `POST /businesses/:businessId/transactions/:transactionId/adjustment-preview` returns a preview-only set of hypothetical journal lines from stored adjustment lines and may include sensitive-account warnings. It does not create `JournalEntry`, create `JournalLine`, or update `Transaction.status`.

Core posting currently supports `SALE`, `EXPENSE`, `PURCHASE`, `CUSTOMER_PAYMENT`, and `SUPPLIER_PAYMENT`. `POST /businesses/:businessId/transactions/:transactionId/post` requires `journalEntries.post`, an `idempotencyKey`, and an optional `postingDate`; it creates a POSTED `JournalEntry`, creates balanced `JournalLine` records, and updates the source transaction status to `POSTED` in one database transaction. Retrying the same idempotency key for the same transaction returns the existing posted journal; reusing the key for another transaction is rejected.

Payment posting uses narrow general AR/AP rules only. `CUSTOMER_PAYMENT` requires a same-business `customerId`, debits Cash, and credits Accounts Receivable. `SUPPLIER_PAYMENT` requires a same-business `supplierId`, debits Accounts Payable, and credits Cash. It does not allocate payments to invoices, update customer or supplier statements, calculate AR/AP aging, or reconcile balances yet.

Draft journal creation remains separate from posting. `Transaction.status = POSTED` is ledger-trustworthy only when produced by the approved posting endpoint with a matching posted journal entry. Existing historical transaction-intent `POSTED` records without a matching posted journal require reconciliation and are not treated as ledger truth.

Adjustment posting is not implemented yet and `POST /businesses/:businessId/transactions/:transactionId/post` still rejects `ADJUSTMENT` safely. Posting does not automate inventory movements, post COGS for sales, write audit logs, call AI tools, generate reports, export PDFs, build dashboards, connect bank/OCR flows, add budgets/goals, add mobile posting UI, or persist chat messages.

## Continuous Integration

GitHub Actions runs on pushes and pull requests to `main`. The `CI` workflow installs dependencies with `npm ci`, validates and generates Prisma Client with a dummy CI `DATABASE_URL`, then runs lint, build, and tests from the repository root.

## Folder Structure

```text
SmartAccountant/
  apps/
    backend/
      prisma/
      src/
        application/
        config/
        database/
        features/
        health/
    mobile/
      src/
        app/
        assets/
        components/
        features/
        navigation/
        store/
        theme/
  packages/
    config/
    shared-types/
    ui/
    utils/
  project-management/
  docs/
```

## Coding Conventions

- TypeScript is strict across all workspaces.
- Feature folders own their module boundaries and should grow by capability, not by technical layer alone.
- Shared code belongs in `packages` only when two or more workspaces need it.
- UI primitives should remain presentation-focused and avoid domain-specific business rules.
- Backend modules should expose explicit NestJS module boundaries and keep infrastructure separate from feature code.
- Path aliases are configured in `tsconfig.base.json`; package imports should use `@finance-ai/*` names.
- Formatting is handled by Prettier and checked through lint-staged before commits.

## Current Scope

This foundation includes project structure, app bootstraps, Prisma configuration, tooling, documentation, local PostgreSQL setup, authentication, tenant-aware authorization, tenant-scoped accounting data APIs, Chart of Accounts configuration, and JournalEntry / JournalLine storage. Double-entry ledger posting, automatic transaction status updates, finalized accounting engine behavior, bank integrations, document ingestion, forecasting, AI orchestration, chat persistence, inventory movement automation, reports, PDFs, budgets, and goals remain outside the current scope.
