# Chat / AI Orchestrator Boundary

## Purpose

The approved Chat UI currently uses local mock responses only. It does not call backend APIs, AI providers, Prisma, database models, authentication services, or accounting tools.

This document defines the future boundary between the Chat UI and the AI Orchestrator. It is a contract guide for a later integration phase, not an implementation plan for this sprint.

## Responsibilities

### Chat UI Owns

- Rendering the conversation list, chat thread, messages, empty states, error states, and retry UI.
- Composer state, suggested prompt selection, local draft updates, and send affordances.
- Typing and streaming display states.
- Settings UI and local-only UI preferences.
- Local optimistic user messages before backend acknowledgement.
- Local retry affordances for failed requests.
- Clear wording that distinguishes drafts, previews, and local mock responses from persisted accounting records.

### AI Orchestrator Owns

- Intent detection for accounting, reporting, inventory, and document requests.
- Entity extraction for customers, suppliers, products, quantities, amounts, dates, taxes, payment methods, and currencies.
- Confidence scoring and clarification decisions.
- Tool selection and tool argument preparation.
- Backend function calls through approved service boundaries.
- Response formatting for user-facing assistant messages.
- Safety checks, duplicate checks, confirmation requirements, and destructive-action safeguards.
- Audit metadata for prompts, model output, tool calls, confirmations, retries, and persistence results.

## Message Lifecycle

1. User writes a message in the Chat UI.
2. Chat UI creates an optimistic user message with a local pending state.
3. Chat service sends the request to the backend using the future chat request contract.
4. AI Orchestrator receives the message and emits an acknowledgement event.
5. AI Orchestrator detects intent, extracts entities, scores confidence, and decides whether clarification or confirmation is required.
6. Streaming assistant events arrive and update the visible assistant message.
7. Tool execution events arrive if backend functions are selected.
8. Confirmation events pause execution when user approval is required.
9. Final assistant message arrives with completion, failure, or clarification state.
10. Chat UI updates message state and conversation preview.

## Future Request Shape

```json
{
  "conversationId": "string",
  "messageId": "string",
  "text": "string",
  "attachments": [],
  "locale": "string",
  "timezone": "string",
  "clientContext": {
    "platform": "android",
    "appVersion": "string"
  }
}
```

Notes:

- `messageId` must be generated before dispatch so retries can use idempotency keys.
- `conversationId` may reference an existing conversation or a newly created local conversation.
- `attachments` is reserved for future document, receipt, image, audio, and file inputs.
- `locale` and `timezone` must be sent with every request because accounting dates and number formats are user-sensitive.
- `clientContext.platform` should distinguish Android, iOS, and web surfaces.

## Future Streaming Event Types

| Event | Purpose |
| --- | --- |
| `message.received` | Backend accepted the user message and associated idempotency key. |
| `assistant.typing` | Orchestrator has started processing but has not emitted content yet. |
| `assistant.delta` | Partial assistant text for the visible streaming message. |
| `assistant.message.completed` | Final assistant text is complete. |
| `tool.started` | A backend tool call began. |
| `tool.requires_confirmation` | Tool execution is paused until the user confirms. |
| `tool.completed` | Tool execution finished successfully and may include persistence metadata. |
| `tool.failed` | Tool execution failed and should surface retry or support guidance. |
| `clarification.required` | Orchestrator needs more information before continuing. |
| `error` | Request, orchestration, validation, or transport failure. |
| `done` | Stream is closed and no more events are expected for this message. |

## Message States

| State | UI Meaning |
| --- | --- |
| `local_pending` | Message exists locally before backend acknowledgement. |
| `sent` | Backend accepted the user message or a non-streaming message is visible. |
| `streaming` | Assistant response is actively receiving deltas. |
| `requires_confirmation` | User must approve before a tool executes. |
| `completed` | Final assistant response and any approved tool work are finished. |
| `failed` | Message failed and may show retry UI. |
| `retrying` | A failed message is being retried. |
| `cancelled` | User or system cancelled the operation. |

## Retry Behavior

- Current Sprint 1 behavior retries failed local mock responses only.
- Future retries may retry failed network requests when the original operation is safe to repeat.
- Future retry requests must reuse idempotency keys derived from the original `messageId`.
- Mutation retries must never duplicate accounting records, inventory adjustments, customer payments, voids, or exports.
- If a tool reached an unknown persistence state, the orchestrator must reconcile before retrying.
- Retry UI should preserve the original user message and explain whether the retry is local-only, network-only, or tool-level.

## Safety and Persistence Wording

The UI must never show `saved`, `recorded`, or `created` unless the backend confirms persistence.

Before backend persistence exists, use language such as:

- "I understood this as a draft."
- "I can prepare this once tool execution is connected."
- "No backend records were changed."

After backend persistence is implemented, assistant responses must distinguish:

- Draft interpretation.
- Pending confirmation.
- Successfully persisted accounting records.
- Failed or cancelled tool execution.
- Actions that require review before they affect books.

## Future Confirmation UI

The Chat UI should later render structured confirmation cards before tool execution for:

- Sale draft.
- Expense draft.
- Purchase draft.
- Inventory adjustment.
- Customer payment.
- Delete or void action.

Each confirmation card should show the extracted entities, confidence warnings, affected records, and explicit actions such as confirm, edit, cancel, or ask a follow-up question.

## Integration With AI_CONTRACT.md

The future integration must follow `project-management/AI_CONTRACT.md` for:

- Supported intent names.
- Required and optional entities.
- Confidence scoring and clarification thresholds.
- Tool behavior and confirmation rules.
- Safety rules for destructive or irreversible actions.
- Structured output expectations.
- Audit metadata requirements.

This boundary document defines how the Chat UI consumes orchestration results. `AI_CONTRACT.md` remains the source of truth for orchestrator reasoning, tool policy, and accounting safety behavior.
