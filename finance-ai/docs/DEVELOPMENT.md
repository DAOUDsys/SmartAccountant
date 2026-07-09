# Development

## Prerequisites

- Node.js 20 or newer.
- npm 11 or newer.
- PostgreSQL for database-backed development once domain models are introduced.
- Expo tooling through the workspace scripts.

## First Run

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Run `npm run prisma:generate`.
4. Start the backend with `npm run dev:backend`.
5. Start the mobile app with `npm run dev:mobile`.

## Quality Checks

Run these from the monorepo root before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run build
npm run format:check
```

## Workspace Imports

Use `@finance-ai/*` package imports for shared packages. App-local aliases are available as `@mobile/*` and `@backend/*` for code that should not cross app boundaries.
