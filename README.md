# Finance AI

Finance AI is a TypeScript-first monorepo foundation for a production-grade AI accounting product. The repository is intentionally initialized with application infrastructure, shared packages, documentation, and development tooling before any authentication or accounting business flows are added.

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

Generate the Prisma client:

```bash
npm run prisma:generate
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
- `npm run format` formats source and documentation with Prettier.
- `npm run format:check` verifies formatting.
- `npm run prisma:generate` generates Prisma Client from `apps/backend/prisma/schema.prisma`.

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

This initialization includes project structure, app bootstraps, Prisma configuration, tooling, documentation, and initial health/readiness surfaces. Authentication, ledgers, bank integrations, document ingestion, forecasting, and AI workflows are deliberately excluded from this foundation phase.
