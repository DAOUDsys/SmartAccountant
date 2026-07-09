# Changelog

## 0.1.5 - 2026-07-10

### Added

- Added Vitest as the minimal TypeScript logic test runner.
- Added focused chat store tests for the local Zustand chat foundation.
- Added `project-management/CHAT_AI_BOUNDARY.md` to define the future Chat UI and AI Orchestrator contract.
- Added GitHub Actions `CI` workflow for pushes and pull requests to `main`.
- Added Prisma schema validation script for CI.
- Documented `npm run test` in the README scripts.

### Changed

- Flattened the repository structure so `apps/`, `packages/`, `project-management/`, `docs/`, and root configuration files now live at the GitHub repository root instead of under `finance-ai/`.
- Updated the README folder structure diagram and project-management notes to reflect the new root layout.
- Expanded root ignore rules for workspace `node_modules`, Expo export output, environment files, build output, coverage, logs, and OS metadata.

### Verified

- No backend, Prisma schema, AI provider, authentication, database, accounting logic, or application behavior was changed.
- `npm run test` passes with 1 Vitest file and 10 tests.
- `npm run lint` passes.
- `npm run build` passes.
- `npm run prisma:validate` passes with a dummy CI `DATABASE_URL`.
- `npm run prisma:generate` passes with a dummy CI `DATABASE_URL`.
- GitHub Actions workflow syntax was reviewed by inspection and will be verified by GitHub after push.

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
