# Database

## Technology

PostgreSQL is the primary database. Prisma is configured as the application data access layer in `apps/backend/prisma/schema.prisma`.

## Current State

The Prisma datasource and client generator are configured. Domain models are intentionally not defined in the foundation phase so that accounting entities can be designed with explicit product requirements.

## Planned Model Areas

- Organizations and memberships.
- Chart of accounts.
- Financial accounts and institutions.
- Transactions and transaction lines.
- Categories, rules, and reconciliation state.
- Reports and generated insights.
- AI extraction jobs and audit records.

## Migration Policy

Migrations should be small, reviewed, and tied to product tasks. Any schema that affects financial records should include validation strategy, rollback notes, and data integrity considerations.
