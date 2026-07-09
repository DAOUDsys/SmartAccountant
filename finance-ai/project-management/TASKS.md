# Tasks

## Done

- Initialize `finance-ai` monorepo.
- Configure npm workspaces for apps and packages.
- Scaffold Expo mobile app.
- Scaffold NestJS backend.
- Configure Prisma for PostgreSQL.
- Configure TypeScript, path aliases, ESLint, Prettier, Husky, lint-staged, and EditorConfig.
- Create shared UI, type, utility, and config packages.
- Create feature-based folders for frontend and backend.
- Create initial project-management documentation.
- Create AI-first `PRODUCT_SPEC.md`.
- Create official `AI_CONTRACT.md` for AI orchestration behavior.
- Implement frontend-only Chat UI experience.
- Make Chat the primary mobile app experience with Expo Router.
- Add Conversation List screen.
- Add Chat Thread screen.
- Add local mock assistant response flow.
- Fix Expo Router Metro runtime error for missing `expo-router/assets/logotype.png`.
- Fix Expo Router Metro runtime error for missing `expo-linking`.
- Add direct mobile dependencies for Expo Router peer modules.
- Harden mobile Metro resolver for monorepo root dependency resolution.
- Add root-level `expo-asset` for Metro asset worker resolution.
- Fix Tamagui runtime error for missing configuration.
- Add canonical `apps/mobile/tamagui.config.ts`.
- Wire `TamaguiProvider` in the Expo root layout to the app-local config.
- Align all direct `tamagui` and `@tamagui/*` packages to exact `1.144.4`.
- Add `react-dom@18.3.1` and `react-native-web@~0.19.13`.
- Run `npm dedupe` to remove duplicate nested Tamagui package copies.
- Replace the Android-crashing Tamagui `TextArea` composer with React Native `TextInput`.
- Fix assistant Markdown bubble width on Android.
- Verify `npx @tamagui/cli check` passes.
- Verify `npm run lint` passes.
- Verify `npm run build` passes.
- Verify Android Metro bundles without Expo Router, `expo-linking`, or Tamagui configuration errors.
- Verify the Android conversation list screen renders in Expo Go during a successful launch run.
- Refine conversation list header copy, title scale, search row, New button, card borders, and spacing.
- Replace remaining `$gray5` token usage with valid Tamagui tokens.
- Add clearer accessibility labels for settings placeholder actions.
- Remove persistence-implying words from local mock assistant responses.
- Attempt SDK-compatible Expo Go reinstall on the Android emulator through Expo CLI.
- Add Android QA scripts with longer waits, UI text readiness checks, and overlay-safe screenshot capture.
- Capture and review Chat UI screenshots for conversation list, chat thread, composer-ready send flow, typing/streaming, assistant response, settings sheet, retry UI, dark mode, and clear conversation.
- Fix native settings sheet crash caused by Tamagui CSS animation props on Android.
- Verify clear conversation works locally without backend persistence.
- Approve Chat UI Sprint 1.

## In Progress

- No active Chat UI Sprint 1 blockers.

## Next Recommended Task

- Add focused tests for chat store behavior before connecting the real backend or AI orchestrator.
- Define the future API boundary between Chat UI and AI Orchestrator.
- Preserve the Android QA scripts and screenshot wait strategy for future mobile UI sprints.

## Next Engineering Support

- Add Docker Compose for local PostgreSQL after chat UI runtime stability is fully verified.
- Add CI workflow for install, lint, type-check, build, and Prisma validation.
- Review npm audit findings and upgrade transitive dependency chains where compatible with Expo and Nest.

## Later

- Authentication and tenant-aware authorization.
- AI engine, DeepSeek integration, prompt builder, tool calling, conversation context, and structured outputs.
- Accounting engine for transactions, customers, suppliers, and ledger.
- Inventory, reports, PDF export, dashboard, voice, and polish phases.
- Budgets, goals, and AI insights only in future versions after the core AI Accountant workflow is mature.
