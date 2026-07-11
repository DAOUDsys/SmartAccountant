# Tenancy Authorization

## Purpose

SmartAccountant / Finance AI must be tenant-aware before accounting features are implemented because every future financial record belongs to a business, not only to an individual user. Transactions, customers, suppliers, products, inventory movements, reports, PDF exports, AI conversations, AI tool calls, and audit logs must all be scoped to the correct business.

This document is the source of truth for the planned authorization model. It defines how users belong to businesses, how roles and permissions should work, how backend requests must be authorized, how the mobile app should select an active business, and how future AI tools must be constrained so they cannot read or mutate data outside the active tenant.

No implementation is included in this document. The Prisma models, backend guards, APIs, mobile switcher, and AI tool enforcement described here are future work.

## Core Concepts

| Concept                          | Definition                                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                             | A person who can authenticate into the app. A user identity is global and can belong to one or more businesses.                                                                         |
| Business / Organization / Tenant | The accounting workspace that owns financial data. In product copy, prefer "Business"; in architecture, "tenant" means the isolation boundary.                                          |
| Membership                       | The relationship connecting one user to one business with a role and status. Authorization is based on membership, not just user identity.                                              |
| Role                             | A named set of responsibilities inside a business, such as Owner, Admin, Accountant, Staff, or Viewer.                                                                                  |
| Permission                       | A specific allowed action, such as creating transactions, exporting reports, inviting members, or approving AI tool execution.                                                          |
| Active Business                  | The business currently selected by the user in the mobile app and passed explicitly to tenant-scoped backend requests.                                                                  |
| Owner                            | The highest-trust business role. The owner can manage settings, members, billing, and all accounting data. A business should always have at least one active owner.                     |
| Admin                            | A high-trust manager role that can manage most operational data and members, but should not automatically own billing or final ownership transfer.                                      |
| Accountant                       | A finance-focused role that can manage accounting records, reports, exports, and AI accounting workflows, but should have limited member and billing access.                            |
| Staff / Employee                 | An operational role for day-to-day entry, such as creating sales or expenses, with limited destructive permissions.                                                                     |
| Viewer                           | A read-only role for users who can inspect business data and reports but cannot create, update, delete, export sensitive files unless explicitly allowed, or execute mutating AI tools. |

## Recommended Product Model

A user can belong to one or more businesses. A business owns accounting data. A membership connects a user to a business and carries the role, status, and invitation metadata needed for authorization.

Recommended relationship:

```text
User
  -> BusinessMember
  -> Business
  -> Transactions / Customers / Suppliers / Products / Reports / AI Conversations / Audit Logs
```

Important product rules:

- Registering a first-time user should eventually create or prompt creation of a default business.
- Users with multiple businesses must always have a visible active business context.
- Business names are not globally unique. The system should distinguish businesses by ID and may allow the same display name for unrelated tenants.
- All accounting and AI features must act inside the active business unless an endpoint is intentionally global, such as listing the user's businesses.

## Recommended Future Prisma Models

These are design recommendations only. Do not treat this section as an implemented schema.

```prisma
model Business {
  id        String    @id @default(uuid())
  name      String
  legalName String?
  currency  String
  locale    String
  timezone  String
  ownerId   String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  owner     User      @relation(fields: [ownerId], references: [id])
  members   BusinessMember[]

  @@index([ownerId])
  @@index([deletedAt])
}

model BusinessMember {
  id          String               @id @default(uuid())
  businessId  String
  userId      String
  role        BusinessRole
  status      BusinessMemberStatus @default(ACTIVE)
  invitedById String?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  business    Business             @relation(fields: [businessId], references: [id])
  user        User                 @relation(fields: [userId], references: [id])
  invitedBy   User?                @relation(fields: [invitedById], references: [id])

  @@unique([businessId, userId])
  @@index([userId])
  @@index([businessId, status])
}

enum BusinessRole {
  OWNER
  ADMIN
  ACCOUNTANT
  STAFF
  VIEWER
}

enum BusinessMemberStatus {
  ACTIVE
  INVITED
  SUSPENDED
  REMOVED
}
```

Additional implementation notes:

- `Business.ownerId` should point to the original or current owner, but ownership-sensitive checks should still verify an active `OWNER` membership.
- Future accounting tables should use `businessId` as a required field and index it.
- Future unique constraints should usually be tenant-scoped, such as `@@unique([businessId, invoiceNumber])`, rather than global.
- Soft-deleted businesses and removed memberships must not authorize access.

## Role Permissions Matrix

The backend should define permissions centrally and test them independently. This matrix is the recommended starting point.

| Action                        | Owner | Admin              | Accountant               | Staff   | Viewer    |
| ----------------------------- | ----- | ------------------ | ------------------------ | ------- | --------- |
| Manage business settings      | Yes   | Yes                | No                       | No      | No        |
| Invite members                | Yes   | Yes                | No                       | No      | No        |
| Remove members                | Yes   | Yes, except owners | No                       | No      | No        |
| Change member roles           | Yes   | Yes, except owners | No                       | No      | No        |
| Manage customers              | Yes   | Yes                | Yes                      | Yes     | No        |
| Manage suppliers              | Yes   | Yes                | Yes                      | Yes     | No        |
| Manage products               | Yes   | Yes                | Yes                      | Yes     | No        |
| Create transactions           | Yes   | Yes                | Yes                      | Yes     | No        |
| Edit transactions             | Yes   | Yes                | Yes                      | Limited | No        |
| Delete / void transactions    | Yes   | Yes                | Yes                      | No      | No        |
| View reports                  | Yes   | Yes                | Yes                      | Limited | Yes       |
| Export PDFs                   | Yes   | Yes                | Yes                      | No      | Limited   |
| Use AI assistant              | Yes   | Yes                | Yes                      | Yes     | View-only |
| Approve AI tool execution     | Yes   | Yes                | Yes for accounting tools | No      | No        |
| Manage subscription / billing | Yes   | Limited            | No                       | No      | No        |

Limited permissions should be explicit in code, not inferred. For example, a Staff user might edit only draft records they created, and a Viewer might export only non-sensitive reports if the product later supports that distinction.

## Backend Authorization Strategy

The access token should identify the authenticated user only. It should not be treated as proof that the user can access a specific business.

Required backend rules:

- JWT contains user identity only, such as `sub`, email, and token metadata.
- Active business is passed explicitly in tenant-scoped requests, usually through a `businessId` route parameter.
- Every tenant-scoped endpoint verifies that the authenticated user has an active membership for the requested `businessId`.
- The backend never trusts a client-supplied `businessId` without a membership lookup.
- Every tenant query includes a `businessId` filter.
- Suspended, removed, invited-only, deleted, or soft-deleted memberships cannot access tenant data.
- Role permissions are checked after membership is confirmed.
- Authorization failures should not reveal whether another tenant's resource exists.
- Shared backend helpers should make the secure path easy, such as `requireBusinessMembership(userId, businessId, permission)`.

Recommended authorization sequence for tenant-scoped requests:

1. Authenticate the request and extract `userId` from JWT.
2. Parse and validate `businessId` from the route or request context.
3. Load active membership for `(userId, businessId)`.
4. Reject if membership does not exist or is not `ACTIVE`.
5. Check the role has the required permission.
6. Execute the query with an explicit `businessId` filter.
7. Include `businessId`, `userId`, action, and result in audit logs where appropriate.

## Recommended Request Pattern

Global authenticated endpoints:

```http
GET /businesses
POST /businesses
```

Tenant-scoped endpoints:

```http
GET /businesses/:businessId
POST /businesses/:businessId/members
GET /businesses/:businessId/transactions
POST /businesses/:businessId/transactions
GET /businesses/:businessId/reports
POST /businesses/:businessId/ai/tool-calls
```

Every tenant-scoped endpoint should verify:

- The user is authenticated.
- The user has an active membership in `businessId`.
- The user's role has the permission required for the requested action.
- Any object IDs in the request body or URL also belong to the same `businessId`.

Avoid patterns where `businessId` is optional for accounting data. Optional tenant scope creates ambiguity and increases the risk of cross-business leakage.

## Active Business Selection

Recommended mobile behavior:

- After login or session restore, fetch the user's businesses.
- If the user has one active business, select it automatically.
- If the user has multiple active businesses, show a business switcher before loading tenant-scoped data.
- Store the selected business locally for convenience.
- Validate the stored active business on app start because memberships may change while the app is closed.
- Switching businesses clears tenant-scoped cached data, including chat context, search results, draft accounting forms, reports, and local optimistic records.
- Logout clears access tokens, refresh tokens, active business, and tenant-scoped cache.
- The active business name should be visible in future accounting and AI surfaces so the user knows where actions will apply.
- Chat context must update when active business changes; stale chat history from another business must not appear as current context.

## AI Tool Authorization

AI tools must follow the same authorization rules as human-driven API calls. The assistant can suggest actions, but the backend is responsible for enforcing identity, membership, tenant scope, permissions, confirmation, and audit logging.

The AI cannot:

- Create a sale unless the user has transaction creation permission in the active business.
- Export a report unless the user has report export permission in the active business.
- Delete or void a transaction unless the user has destructive accounting permission.
- Access customer, supplier, product, report, transaction, or chat data outside the active business.
- Infer or leak data from another business through memory, retrieval, tool results, or prompt context.
- Execute a tool using a stale active business after membership removal or suspension.

Required AI tool-call rules:

- Include `activeBusinessId` in every tool call request.
- Verify authenticated user identity.
- Verify active membership in `activeBusinessId`.
- Verify permission for the exact tool action.
- Check all referenced object IDs belong to `activeBusinessId`.
- Log attempted action, authorized action, denied action, and final result where appropriate.
- Require explicit user confirmation for risky operations such as deletes, voids, exports, billing changes, and bulk updates.
- Keep AI memory, retrieval context, conversation summaries, embeddings, and tool outputs scoped by `businessId`.
- Return safe denial messages without exposing another business's data or confirming another resource exists.

Recommended AI authorization pattern:

```text
User prompt
  -> Intent classification
  -> Candidate tool selection
  -> Confirmation check for risky action
  -> Membership and permission verification
  -> Tenant-scoped tool execution
  -> Tenant-scoped audit log
  -> Response that does not overclaim persistence
```

## Data Isolation Rules

Strict tenant isolation rules:

- Every accounting table must include a required `businessId`.
- Every AI conversation, AI message, AI tool call, AI memory record, and AI retrieval artifact must include `businessId`.
- Every audit log entry for tenant activity must include `businessId`.
- Every tenant query must filter by `businessId`.
- No cross-tenant joins are allowed unless the query is explicitly global administration code and has separate privileged authorization.
- Unique constraints should usually be tenant-scoped.
- Background jobs must run with an explicit `businessId` and should process one tenant scope at a time.
- PDF exports must be generated from tenant-scoped queries only.
- Report caches must include `businessId` in their cache key.
- Mobile local cache keys must include active business identity or be cleared when the active business changes.
- Logs must avoid storing sensitive tenant data unless required for audit and protected accordingly.

## Security Risks and Mitigations

| Risk                                           | Mitigation                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| IDOR / broken object-level authorization       | Check membership and `businessId` ownership for every object ID. Never fetch by object ID alone for tenant data.                             |
| Customer statements leaking across tenants     | Generate statements only from queries scoped by `businessId`; include tenant scope in export jobs and cache keys.                            |
| Stale active business after membership removal | Revalidate active membership on app start, refresh, and every tenant request. Reject removed or suspended memberships even with a valid JWT. |
| AI tool executing in the wrong business        | Require `activeBusinessId`, display the active business in the UI, confirm risky actions, and re-check membership before tool execution.     |
| Cached mobile data from a previous business    | Clear tenant-scoped cache on business switch, logout, and membership invalidation. Use business-aware cache keys.                            |
| Duplicate business names causing confusion     | Use IDs for authorization and show secondary identity details where needed, such as legal name, owner, or currency.                          |
| Role escalation                                | Restrict role changes to permitted roles, prevent admins from changing owner roles, and audit all membership changes.                        |
| Deleted membership still using old token       | Do not encode business permission into long-lived tokens. Check membership from the database on every tenant request.                        |
| Soft-deleted business still accessible         | Include `deletedAt: null` in business and membership checks.                                                                                 |
| Cross-tenant AI memory retrieval               | Partition retrieval indexes and memory records by `businessId`; never retrieve memory from global user scope for accounting answers.         |

## Future Implementation Plan

### Phase 1: Tenancy Foundation

- Add `Business`, `BusinessMember`, `BusinessRole`, and `BusinessMemberStatus` schema.
- Create a default business on registration or add a required onboarding step immediately after registration.
- Add a membership guard for tenant-scoped backend routes.
- Add an active business endpoint or current context endpoint for the mobile app.
- Add tests proving a user cannot access another business by guessing IDs.

### Phase 2: Roles and Business Switching

- Implement centralized permission definitions.
- Add role permission checks on top of membership checks.
- Add mobile business switcher.
- Add member invitation flow.
- Add member suspension/removal behavior and local session invalidation handling.

### Phase 3: Tenant-Scoped Accounting and AI

- Add tenant-scoped accounting models for customers, suppliers, products, transactions, reports, and exports.
- Add tenant-scoped AI conversation and tool-call records.
- Add audit logs for accounting, member, export, and AI tool actions.
- Enforce confirmation for risky AI tool execution.
- Add integration tests covering tenant isolation across backend APIs, AI tools, and exports.

## Acceptance Criteria for Future Implementation

When tenant-aware authorization is implemented, the following must be true:

- Every tenant-scoped endpoint checks authentication, active membership, and role permission.
- Every tenant-scoped query filters by `businessId`.
- Users cannot access another business by guessing business IDs or object IDs.
- Suspended, removed, invited-only, and soft-deleted memberships cannot access tenant data.
- Mobile shows or maintains a clear active business context.
- Logout clears active business and tenant-scoped local cache.
- Business switching clears stale tenant-scoped data.
- AI tools cannot execute outside the active business.
- AI tools cannot retrieve memory or context from another business.
- Risky AI tool calls require explicit confirmation.
- Membership removal invalidates future access even if the user still has a valid access token.
- Tests cover positive and negative authorization paths for every tenant-scoped feature.
