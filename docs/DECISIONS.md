# Decisions

## npm Workspaces

npm workspaces keep the foundation lightweight while still supporting shared packages, workspace scripts, and a single lockfile.

## Feature-Based App Structure

Both mobile and backend use feature folders so accounting capabilities can grow with clear ownership boundaries.

## Prisma Without Domain Models

Prisma is configured early to validate the data access toolchain. Domain models are deferred until product requirements are explicit enough to protect financial data integrity.

## Shared UI Package

The UI package starts with simple Tamagui primitives. Components remain domain-neutral until repeated product patterns justify promotion into shared code.
