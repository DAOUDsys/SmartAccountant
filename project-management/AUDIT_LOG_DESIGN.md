# Audit Log Design

## Purpose

SmartAccountant / Finance AI needs a secure audit log because accounting systems must explain who attempted or completed important actions, when the action happened, which tenant it affected, which records were involved, and whether the action succeeded, failed, or was denied.

The audit log is evidence. It is not the ledger. Financial truth remains in `JournalEntry` and `JournalLine` records created through approved posting and reversal pathways. Audit records help support security review, compliance review, user accountability, incident response, and future AI tool traceability without changing accounting outcomes.

This document is architecture only. It does not modify Prisma schema, create migrations, add endpoints, implement audit writes, change posting or reversal behavior, add accounting periods, implement inventory movements, add COGS, add approvals, integrate AI orchestration, persist chat, generate reports, export PDFs, build dashboards, or add mobile audit UI.

## Core Rules

1. Audit records are append-only.
2. Audit records must never contain secrets.
3. Every tenant-owned audit record must include `businessId`.
4. Successful accounting writes should be audited atomically where appropriate.
5. Failed attempts must be captured safely without creating partial accounting state.
6. Audit logging must not silently change accounting results.
7. Audit events are evidence, not the accounting ledger itself.

## Current Implementation Context

The current backend already has these relevant foundations:

- `User` and `RefreshToken` authentication storage, with password hashes and hashed refresh tokens.
- `Business`, `BusinessMember`, `BusinessRole`, and `BusinessMemberStatus` for tenant-aware authorization.
- Tenant-scoped `Customer`, `Supplier`, `Product`, `Transaction`, `TransactionLine`, `TransactionAdjustmentLine`, `Account`, `AccountMapping`, `JournalEntry`, and `JournalLine` records.
- Atomic posting through `PostingService.postTransaction`, which creates a POSTED `JournalEntry`, creates balanced `JournalLine` records, and updates `Transaction.status` to `POSTED` in one Prisma transaction.
- Atomic reversal through `ReversalService.reverseTransaction`, which creates a POSTED reversal journal, creates swapped reversal lines, marks the original journal `REVERSED`, and marks the source transaction `VOIDED` in a Serializable Prisma transaction.
- DRAFT transaction cancellation through `TransactionsService.voidTransaction`, with direct POSTED void blocked by `POSTED_TRANSACTION_REQUIRES_REVERSAL`.
- Membership and permission enforcement through `BusinessMembershipGuard` and central business permissions.

Not currently present:

- `AuditLog` schema.
- Request ID or correlation ID middleware.
- Request logging interceptor dedicated to security/audit events.
- Global exception filter dedicated to safe audit-failure capture.
- Audit read API.
- Audit write service.

## Ledger, Domain, And Audit Data

### Ledger Data

Ledger data is financial truth. In the current approved accounting boundary, ledger truth is represented by POSTED `JournalEntry` and balanced `JournalLine` records.

Ledger data answers financial questions such as balances, revenue, expenses, cash movement, and reversal net effect. Reports must read ledger data, not audit records.

### Domain Data

Domain data describes business objects and workflow state. Examples include customers, suppliers, products, transactions, adjustment intent lines, accounts, account mappings, businesses, and memberships.

Domain data may be the source intent for a posting or reversal, but it is not a substitute for a posted journal.

### Audit Data

Audit data is evidence describing action attempts and outcomes. It answers questions such as:

- Who attempted the action?
- Which business was affected?
- Which entity was involved?
- Was the action successful, failed, or denied?
- Which safe error code or reason explains the result?
- Which request or correlation ID ties this event to logs or support traces?

Audit logs must not:

- Replace `JournalEntry` or `JournalLine`.
- Determine account balances.
- Be used to reconstruct missing ledger records.
- Modify financial outcomes.
- Store complete request bodies automatically.
- Store passwords, password hashes, tokens, secrets, cookies, or authorization headers.

## Security And Privacy Rules

Audit data is sensitive because it can describe business activity, users, IP addresses, and failed access attempts. The audit subsystem must use server-side serialization and redaction. It must never trust metadata supplied directly by clients.

### Never Store

Audit records must never store:

- Access tokens.
- Refresh tokens.
- Authorization headers.
- Cookies.
- Password values.
- Password hashes.
- Password reset tokens.
- API keys.
- DeepSeek, OpenAI, or other provider keys.
- Database connection strings.
- SMTP credentials.
- Full card numbers or bank credentials.
- Unfiltered request bodies.
- Unfiltered response bodies.
- Raw exception objects.
- Raw Prisma errors.
- Stack traces.
- Private environment variables.
- Hidden chain-of-thought.
- Full model prompts or full model response dumps.

### Data Minimization

Recommended behavior:

- Store entity IDs instead of full entity objects.
- Store changed field names instead of complete before/after snapshots by default.
- Store only allowlisted metadata.
- Mask email addresses unless the full email is required for a security event.
- Store safe error codes, not raw error messages from dependencies.
- Store idempotency key fingerprints, not raw idempotency keys, where possible.
- Limit metadata size and depth.
- Apply redaction before persistence.

### Email Masking

When full email values are unnecessary, mask them consistently, for example:

```text
ah***@example.com
```

For login/register security events, a normalized email fingerprint may be safer than storing the full attempted email. If support workflows require full email visibility later, that must be explicitly approved and permission-gated.

## Future AuditLog Model

Recommended future Prisma shape:

```prisma
model AuditLog {
  id                String          @id @default(uuid())
  businessId        String?
  actorUserId       String?
  actorType         AuditActorType
  eventType         String
  action            String
  outcome           AuditOutcome
  entityType        String?
  entityId          String?
  relatedEntityType String?
  relatedEntityId   String?
  requestId         String?
  correlationId     String?
  source            AuditSource
  ipAddress         String?
  userAgent         String?
  reason            String?
  errorCode         String?
  metadata          Json?
  occurredAt        DateTime        @default(now())
  createdAt         DateTime        @default(now())

  business          Business?       @relation(fields: [businessId], references: [id])
  actorUser         User?           @relation(fields: [actorUserId], references: [id])

  @@index([businessId, occurredAt])
  @@index([businessId, eventType, occurredAt])
  @@index([businessId, entityType, entityId])
  @@index([businessId, actorUserId, occurredAt])
  @@index([correlationId])
  @@index([requestId])
}

enum AuditActorType {
  USER
  SYSTEM
  IMPORT
  FUTURE_AI_TOOL
}

enum AuditOutcome {
  SUCCESS
  FAILURE
  DENIED
}

enum AuditSource {
  API
  MOBILE
  SYSTEM_RETRY
  IMPORT
  BACKGROUND_JOB
  FUTURE_AI_TOOL
}
```

### Event Names And Actions

`eventType` and `action` should initially be stable strings rather than database enums.

Reasoning:

- The event catalog will evolve quickly while accounting workflows mature.
- Adding enum values through Prisma migrations for every new event creates unnecessary migration churn.
- Stable strings can still be safe when controlled by backend code.

Rules:

- Centralize event names as TypeScript constants, for example `AUDIT_EVENTS.TRANSACTION_POST_SUCCEEDED`.
- Validate event names through an internal catalog.
- Do not accept arbitrary event names from API clients.
- Keep event names uppercase snake case.
- Keep `action` lower-level and stable, such as `create`, `update`, `post`, `reverse`, `login`, `deny`, or `retry`.

## Tenant Scoping

Business-owned actions must include `businessId`. This includes accounting configuration, domain data, posting, reversal, adjustment, membership, report, export, and future AI tool events.

Rules:

- Every tenant-owned audit write must include `businessId`.
- Every audit read query must filter by `businessId`.
- Cross-tenant audit access must be denied.
- Entity IDs from another business must never be exposed through audit responses.
- A user who belongs to multiple businesses must see only audit events for the selected business.
- After a route resolves `businessId` through `BusinessMembershipGuard`, audit events for that request should use that resolved business context.
- Global authentication attempts may have `businessId = null` before a business is resolved.
- Authentication events after default business resolution may include `businessId` when appropriate.

### Nullable businessId Or Separate Global Table

Recommended direction: use one `AuditLog` table with nullable `businessId` only for explicitly global authentication or system events.

Why:

- One table keeps query, retention, and operational monitoring simpler.
- Most events are tenant-scoped and must have `businessId`.
- A nullable `businessId` supports anonymous or pre-tenant auth attempts without creating a second system.
- Read permissions can distinguish business audit access from global security audit access.

Global auth/security events with `businessId = null` must be administrative-only and unavailable through tenant audit endpoints.

## Append-Only Immutability

Audit records must be append-only from the application perspective.

Rules:

- No application API updates audit records.
- No normal application API deletes audit records.
- No public audit create, update, or delete endpoint exists.
- Audit events are created only by trusted backend services.
- Corrections create a new audit event instead of editing an old event.
- Retention, legal deletion, or archival must be a separate privileged administrative process.
- Direct database mutation should be restricted operationally in production.

Future hardening options:

- Dedicated immutable `AuditLogService` with no update/delete methods.
- Database role permissions that allow app inserts and reads but block update/delete in production.
- Hash chaining to detect tampering.
- External write-once archival for high-trust environments.
- Tamper monitoring and alerting.

These hardening options are future work and are not implemented by this task.

## Event Catalog

The event catalog is the allowlist of stable event names. It should live in backend code as constants in a future implementation.

### Authentication

- `AUTH_REGISTER_SUCCEEDED`
- `AUTH_REGISTER_FAILED`
- `AUTH_LOGIN_SUCCEEDED`
- `AUTH_LOGIN_FAILED`
- `AUTH_REFRESH_SUCCEEDED`
- `AUTH_REFRESH_FAILED`
- `AUTH_LOGOUT_SUCCEEDED`
- `AUTH_PASSWORD_CHANGED`
- `AUTH_PASSWORD_RESET_REQUESTED`
- `AUTH_PASSWORD_RESET_COMPLETED`

### Business And Membership

- `BUSINESS_CREATED`
- `BUSINESS_MEMBER_ADDED`
- `BUSINESS_MEMBER_ROLE_CHANGED`
- `BUSINESS_MEMBER_STATUS_CHANGED`
- `BUSINESS_ACCESS_DENIED`

### Accounting Configuration

- `ACCOUNT_CREATED`
- `ACCOUNT_UPDATED`
- `ACCOUNT_DELETED`
- `ACCOUNT_MAPPING_UPDATED`

### Domain Data

- `CUSTOMER_CREATED`
- `CUSTOMER_UPDATED`
- `CUSTOMER_DELETED`
- `SUPPLIER_CREATED`
- `SUPPLIER_UPDATED`
- `SUPPLIER_DELETED`
- `PRODUCT_CREATED`
- `PRODUCT_UPDATED`
- `PRODUCT_DELETED`
- `TRANSACTION_CREATED`
- `TRANSACTION_UPDATED`
- `TRANSACTION_DRAFT_VOIDED`
- `ADJUSTMENT_LINES_REPLACED`

### Posting

- `POSTING_PREVIEW_REQUESTED`
- `TRANSACTION_POST_ATTEMPTED`
- `TRANSACTION_POST_SUCCEEDED`
- `TRANSACTION_POST_FAILED`
- `TRANSACTION_POST_IDEMPOTENT_RETRY`
- `TRANSACTION_POST_DENIED`

### Reversal

- `REVERSAL_PREVIEW_REQUESTED`
- `TRANSACTION_REVERSAL_ATTEMPTED`
- `TRANSACTION_REVERSAL_SUCCEEDED`
- `TRANSACTION_REVERSAL_FAILED`
- `TRANSACTION_REVERSAL_IDEMPOTENT_RETRY`
- `TRANSACTION_REVERSAL_DENIED`

### Journal

- `JOURNAL_DRAFT_CREATED`
- `JOURNAL_DRAFT_VOIDED`
- `JOURNAL_READ_DENIED`

### Preview And Read Audit Policy

Persisted audit logs should not replace application logs.

Recommended policy:

- Persist high-risk financial previews when they precede posting or reversal.
- Persist denied access attempts to high-risk accounting actions.
- Persist posting and reversal attempts/results.
- Do not persist every ordinary read by default.
- Keep high-volume request diagnostics in application logs and observability tooling, not necessarily `AuditLog`.

## Successful Accounting Event Atomicity

Successful posting and reversal audit events should be written atomically with the accounting changes once audit logging is declared mandatory.

### Posting Success

For successful posting, future implementation should create `TRANSACTION_POST_SUCCEEDED` inside the same Prisma transaction:

1. Create POSTED `JournalEntry`.
2. Create `JournalLine` records.
3. Update `Transaction.status` to `POSTED`.
4. Create `TRANSACTION_POST_SUCCEEDED` audit event.
5. Commit all changes.

If the success audit event cannot be persisted after audit logging is mandatory, the posting should fail and roll back. A posted ledger change without required audit evidence should not be accepted in production.

### Reversal Success

For successful reversal, future implementation should create `TRANSACTION_REVERSAL_SUCCEEDED` inside the same Serializable Prisma transaction:

1. Create reversal `JournalEntry`.
2. Create reversal `JournalLine` records.
3. Mark original `JournalEntry` `REVERSED`.
4. Mark source `Transaction` `VOIDED`.
5. Create `TRANSACTION_REVERSAL_SUCCEEDED` audit event.
6. Commit all changes.

If the success audit event cannot be persisted after audit logging is mandatory, the reversal should fail and roll back.

### Mandatory Or Best Effort

Recommended approach:

- Development phase: audit writes may be best-effort for low-risk non-accounting events while the service matures.
- Production accounting phase: success audit events for posting, reversal, DRAFT cancellation, and high-risk administrative changes should be mandatory.
- Failed/denied events should be best-effort from the user-facing response perspective, but failures to write them must go to operational monitoring.

This gives developers room to introduce the subsystem safely while preserving strong accounting guarantees before production reliance.

## Failed Attempt And Denied Events

Failed attempts often happen inside transactions that roll back. A failure audit event cannot always be written in the same transaction as the failed accounting work.

Recommended failure path:

1. Execute the domain action through normal service logic.
2. If the domain transaction fails and rolls back, catch the safe domain error outside the failed transaction boundary.
3. Serialize a safe `FAILURE` or `DENIED` audit event through the audit service.
4. Include only safe `errorCode`, entity IDs, and allowlisted context.
5. Return the original safe domain error to the user.
6. If the audit-write fails, send that audit-write failure to operational monitoring without replacing the domain error.

Outcome meanings:

- `SUCCESS`: completed business action.
- `FAILURE`: validation, consistency, stale state, duplicate, or execution failure.
- `DENIED`: authorization or tenant access rejected.
- Idempotent retries are still `SUCCESS` or a dedicated event name such as `TRANSACTION_POST_IDEMPOTENT_RETRY`, but they should not duplicate the original success event.

Do not store stack traces, raw Prisma details, headers, tokens, cookies, or complete payloads in failed-attempt audit records.

## Metadata Contract

`metadata` must be a strict allowlisted JSON object. It is not a dumping ground for request bodies.

### Global Metadata Rules

- Maximum serialized size: 8 KB per audit event in the first implementation.
- Maximum nesting depth: 3.
- Maximum array length: 25.
- Keys must be backend-defined, not client-defined.
- Values must be strings, numbers, booleans, null, or short arrays/objects that pass the allowlist.
- Unknown keys are rejected or dropped before persistence.
- Secret-like keys are always rejected, including `password`, `token`, `authorization`, `cookie`, `secret`, `apiKey`, `connectionString`, and `privateKey`.

### Safe Posting Metadata

Allowed posting metadata:

- `transactionType`
- `transactionStatusBefore`
- `transactionStatusAfter`
- `journalEntryId`
- `lineCount`
- `totalDebit`
- `totalCredit`
- `currency`
- `postingDate`
- `source`
- `idempotencyKeyFingerprint`

### Safe Reversal Metadata

Allowed reversal metadata:

- `originalJournalEntryId`
- `reversalJournalEntryId`
- `lineCount`
- `totalDebit`
- `totalCredit`
- `reversalDate`
- `originalJournalStatusBefore`
- `originalJournalStatusAfter`
- `transactionStatusBefore`
- `transactionStatusAfter`
- `source`
- `idempotencyKeyFingerprint`

### Idempotency Key Fingerprints

Do not store full idempotency keys in audit metadata when avoidable.

Recommended fingerprint:

- `sha256(idempotencyKey)` stored as a short prefix, such as first 12 to 16 hex characters.
- The fingerprint is for evidence and debugging only.
- It must never replace the actual idempotency mechanism in domain tables.
- The real idempotency key can continue to live in `JournalEntry.idempotencyKey` until a future request-hash/idempotency-store design replaces or hardens it.

## Actor And Request Context

Trusted backend code should build audit context from server-side sources.

### Human Requests

- `actorUserId`: authenticated JWT context.
- `actorType`: `USER`.
- `businessId`: guarded route parameter after membership resolution.
- `requestId`: generated by backend middleware.
- `correlationId`: generated by backend middleware or safely propagated from a trusted header.
- `ipAddress`: request IP from Nest/Express context, normalized for proxy configuration.
- `userAgent`: request user agent, length-limited.
- `source`: derived from trusted endpoint context, DTO source enum, or client platform known to the backend.

### Background Jobs

- `actorType`: `SYSTEM`.
- `actorUserId`: null.
- `businessId`: required when processing tenant data.
- `correlationId`: stable job run ID.
- `source`: `BACKGROUND_JOB` or `SYSTEM_RETRY`.

### Imports

- `actorType`: `IMPORT` or `USER` depending on who initiated the import.
- `source`: `IMPORT`.
- Metadata may include safe file/import IDs, never raw uploaded data.

### Future AI Tools

AI context must be server-derived from a trusted orchestration layer. Clients must not be able to claim AI actor context directly.

## Future Read API Design

Future read-only endpoints:

```http
GET /businesses/:businessId/audit-logs
GET /businesses/:businessId/audit-logs/:auditLogId
```

Supported filters:

- `eventType`
- `outcome`
- `actorUserId`
- `entityType`
- `entityId`
- `dateFrom`
- `dateTo`
- `correlationId`
- `requestId`
- `cursor`
- `limit`

Rules:

- Always tenant-scoped.
- Always check active membership.
- Always enforce audit permissions.
- Default newest-first.
- Bounded page size, recommended default 50 and maximum 100.
- Cursor pagination preferred over offset for scale.
- Return safe metadata only.
- Never expose raw stack traces, secrets, headers, or redacted fields.
- No create/update/delete endpoints.

## Permission Model

Recommended future permissions:

- `auditLogs.read`
- `auditLogs.readSecurity`

Role behavior:

| Role       | Accounting Audit Events                   | Security/Membership Audit Events |
| ---------- | ----------------------------------------- | -------------------------------- |
| OWNER      | Allowed                                   | Allowed                          |
| ADMIN      | Allowed                                   | Allowed                          |
| ACCOUNTANT | Allowed for accounting-domain events only | Denied                           |
| STAFF      | Denied                                    | Denied                           |
| VIEWER     | Denied initially                          | Denied                           |

Recommended policy:

- OWNER and ADMIN can read all business audit events.
- ACCOUNTANT can read accounting-domain audit events only, such as transaction, posting, reversal, account, mapping, customer, supplier, product, and journal events.
- ACCOUNTANT should not see authentication, member-management, role-change, or security-denied details by default.
- STAFF and VIEWER cannot read audit logs initially.
- Global auth/security logs with `businessId = null` are administrative-only and should require `auditLogs.readSecurity` through a separate admin surface.

This split avoids exposing sensitive security information to finance users while still letting accountants review accounting evidence.

## Retention And Scale

Audit logs grow forever unless retention and archival policies exist.

Future considerations:

- Tenant-level pagination and filtering.
- Append-only growth and storage costs.
- Legal retention requirements by market.
- Privacy deletion requirements for personal data.
- Exported audit evidence for accountants or support review.
- Partitioning for large deployments.
- Archival to lower-cost storage.
- Tamper monitoring.
- Backups and restore testing.

Recommended indexes:

- `businessId + occurredAt`
- `businessId + eventType + occurredAt`
- `businessId + entityType + entityId`
- `businessId + actorUserId + occurredAt`
- `correlationId`
- `requestId`

Do not implement retention, archival, or partitioning in the initial design phase.

## Error Handling

Audit subsystem errors must be safe and stable.

Recommended internal error codes:

- `AUDIT_EVENT_INVALID`
- `AUDIT_METADATA_REJECTED`
- `AUDIT_WRITE_FAILED`
- `AUDIT_ACCESS_DENIED`

The audit subsystem must not expose:

- Raw database errors.
- Internal metadata serialization failures.
- Sensitive exception details.
- Secrets or redacted values.

For accounting success events declared mandatory:

- Audit write failure rolls back the accounting transaction.
- The API returns a safe internal-operation failure.
- Operational monitoring receives the detailed safe diagnostic.

For failure or denied audit events:

- Audit write failure must not change the original domain response.
- The original safe domain error remains the user-facing response.
- Audit write failure is sent to operational logging/monitoring.

## AI Boundary

Future AI tool execution must create audit evidence. AI must not be able to disable, weaken, or bypass auditing.

AI audit records should eventually include:

- `actorType = FUTURE_AI_TOOL` or `actorType = USER` with safe AI-assistance metadata.
- The user who confirmed the action.
- Tool name.
- `businessId`.
- Entity IDs affected.
- Confirmation reference.
- Outcome.
- Safe model/provider metadata.
- Safe idempotency or tool-call fingerprint.

AI audit records must not include:

- API keys.
- Hidden chain-of-thought.
- Full prompts containing sensitive raw financial data unless explicitly approved.
- Full model response dumps.
- Unredacted attachments.
- Cross-tenant memory references.

No AI auditing is implemented in this phase.

## Future Testing Plan

Future implementation must include tests for:

1. AuditLog is tenant-scoped.
2. AuditLog is append-only.
3. No public create/update/delete API exists.
4. OWNER can read business audit events.
5. ADMIN can read business audit events.
6. ACCOUNTANT can read accounting events only.
7. STAFF denied.
8. VIEWER denied.
9. Cross-tenant access denied.
10. Posting success writes one audit event atomically.
11. Posting rollback writes no success event.
12. Posting validation failure writes a failure event outside the rolled-back transaction.
13. Reversal success writes one audit event atomically.
14. Reversal rollback writes no success event.
15. Reversal denied writes safe DENIED event.
16. Same-key posting retry is auditable without duplicate success events.
17. Same-key reversal retry is auditable without duplicate success events.
18. Metadata allowlist rejects secrets.
19. Authorization header is never persisted.
20. Access and refresh tokens are never persisted.
21. Password and passwordHash values are never persisted.
22. Raw Prisma errors are never persisted.
23. RequestId and correlationId are persisted when available.
24. Background system actor behavior works.
25. Date and entity filters remain tenant-scoped.
26. Pagination is bounded.
27. Audit read does not expose redacted fields.
28. Accounting behavior remains unchanged when audit writes succeed.
29. Mandatory success-audit failure rolls back accounting action.
30. Failed-attempt audit failure does not replace the original domain error.

## Implementation Phases

### Phase 1: Design And Integration Contract

- Create this document.
- Update project-management status, tasks, and changelog.
- Do not implement schema, APIs, audit writes, periods, inventory, approvals, AI, reports, PDFs, dashboards, chat persistence, or mobile audit UI.

### Phase 2: AuditLog Schema And Internal Service

- Add `AuditLog` schema and migration.
- Add `AuditActorType`, `AuditOutcome`, and `AuditSource` enums.
- Add event catalog constants.
- Add metadata allowlist and redaction utilities.
- Add append-only internal `AuditLogService`.
- Add request ID and correlation ID middleware.
- Add tenant-scoped read API.
- Add `auditLogs.read` and `auditLogs.readSecurity` permissions.

### Phase 3: Accounting Success Integration

- Add mandatory in-transaction success audit events for posting and reversal.
- Add DRAFT cancellation audit event.
- Ensure audit success write failure rolls back mandatory accounting actions.

### Phase 4: Auth, Membership, Config, And Domain Events

- Add auth success/failure events.
- Add membership and business events.
- Add account and account mapping events.
- Add customer, supplier, product, transaction, and adjustment-line events.

### Phase 5: Operational Monitoring, Retention, And Archival

- Monitor audit write failures.
- Add retention and archival policy.
- Add exportable audit evidence if required.
- Add tamper monitoring where appropriate.

### Phase 6: AI Tool Auditing

- Add AI tool audit events after AI execution is approved.
- Include user confirmation references and safe tool metadata.
- Keep AI auditing tenant-scoped and non-bypassable.

## Future Implementation Acceptance Criteria

Implementation is accepted only when:

- AuditLog is tenant-scoped.
- Events are append-only.
- Secrets are never stored.
- No client can create arbitrary events.
- Metadata is allowlisted and size-limited.
- Posting and reversal success events are atomic with accounting writes.
- Failure events are persisted safely after transaction rollback.
- Cross-tenant reads are denied.
- Permissions are enforced.
- Read endpoints are paginated and filtered.
- Tests pass.
- Existing accounting behavior remains unchanged.
- No AI, reporting, inventory, period, approval, or mobile scope creep occurs.

## Non-Implementation Statement

This task creates the audit log design and integration contract only. It does not add Prisma schema, create migrations, add backend endpoints, implement audit writes, change posting or reversal behavior, implement accounting periods, implement inventory movements or COGS, add approvals, integrate AI orchestration, persist chat, generate reports, export PDFs, build dashboards, or add mobile audit UI.
