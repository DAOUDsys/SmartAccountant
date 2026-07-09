# Architecture

## Overview

Finance AI is structured as a monorepo with deployable applications in `apps` and reusable code in `packages`. The initial architecture favors clear boundaries, strict typing, and feature-oriented growth.

## Application Boundaries

- `apps/mobile` owns the customer-facing mobile experience.
- `apps/backend` owns API delivery, configuration, database access, and server-side feature modules.
- `packages/ui` owns shared presentation primitives built with Tamagui.
- `packages/shared-types` owns serializable contracts shared across workspaces.
- `packages/utils` owns framework-neutral helpers.
- `packages/config` owns shared configuration such as Tamagui setup.

## Backend Structure

The backend uses NestJS modules. Infrastructure concerns live in top-level folders such as `config`, `database`, and `health`. Product capabilities live under `src/features`, where each feature can later own controllers, services, DTOs, policies, jobs, and tests.

## Mobile Structure

The mobile app uses a feature-based structure under `src/features`. Shared screen-independent code lives in `components`, `navigation`, `store`, and `theme`. Zustand is available for client state, while server state should be introduced deliberately when API workflows exist.

## Shared Code Rules

Code should move into `packages` only when reuse is real. App-specific code should stay in its app. Shared types must remain serializable and avoid importing framework-specific dependencies.
