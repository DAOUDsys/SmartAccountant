# API

## Technology

The API is built with NestJS and runs from `apps/backend`. Configuration is loaded through `@nestjs/config`.

## Current Endpoints

- `GET /health` returns service readiness metadata for local development and platform health checks.

## Planned API Standards

- Version public routes before domain APIs are introduced.
- Use DTOs for request validation.
- Use consistent error response shapes.
- Keep feature modules self-contained.
- Keep authentication and authorization concerns centralized once introduced.

## Local Development

The backend defaults to port `3000`. The mobile app reads its base URL from `EXPO_PUBLIC_API_URL`, with `http://localhost:3000` as the default.
