# Inquiry Desk architecture

## Product boundary

Inquiry Desk is a single web intake channel for small service teams. A visitor submits an inquiry; operators classify, review, draft, approve, explicitly deliver, and close it. The system has no autonomous outbound agent, calendar side effect, CRM sync, or multi-channel identity graph.

## Runtime shape

```text
visitor -> /api/intake -> validation/rate/idempotency -> extractor provider
                                      |                  -> structured fields + run
                                      v
                             InquiryStore boundary
                                      |
Supabase Auth cookie -> server auth adapter -> membership -> owner APIs -> queue/detail -> workflow
                                                                      |                    |
                                                                      +-> inquiries         +-> inquiry_events
```

The Next.js App Router owns UI and request boundaries. `lib/domain.ts` defines domain vocabulary and Zod contracts. `lib/workflow.ts` is the single transition guard. `lib/extraction.ts` exposes an injectable provider interface with a deterministic fallback. `lib/delivery.ts` exposes mock and webhook delivery providers; mock delivery is explicit and never described as external delivery.

## Demo and persisted modes

`DEMO_MODE=true` is an explicit, account-free mode. `getStore()` selects the isolated in-memory store before examining Supabase variables, so demo writes cannot reach production tables. Demo login remains the `demo` access code unless overridden by `OWNER_ACCESS_TOKEN`.

`DEMO_MODE=false` requires Supabase URL/publishable key and uses a new SSR client per request. Supabase Auth owns the session; middleware refreshes cookies, and server routes call `auth.getUser()` before workspace access. The service-role client exists only in `lib/auth.ts` for idempotently creating/linking `app_users`, `auth_identities`, and default memberships. It is never imported by UI code or bundled into browser code.

Persisted intake is authenticated-only in this slice. The demo remains the recruiter-facing public intake. Anonymous production intake, CAPTCHA/rate limiting beyond the current process guard, and provider-side Auth configuration require a later reviewed slice.

## Portable persistence model

The migration source of truth is `supabase/migrations/202608110001_inquiry_persistence.sql`; `supabase/schema.sql` is a clean-install reference copy. The domain tables are:

- `app_users`: internal application identity, independent of Supabase Auth IDs.
- `auth_identities`: `(provider, subject)` mapping; currently the narrow `supabase` adapter.
- `workspaces`: tenant boundary and inquiry schema configuration.
- `workspace_memberships`: protected workspace role relation (`owner`, `manager`, `operator`, `viewer`).
- `inquiries`: existing `InquiryLead` payload plus indexed tenant/status/idempotency/fingerprint columns.
- `inquiry_events`: append-oriented audit rows with tenant, target, action, actor, detail, metadata, and UTC timestamp.

The JSON payload preserves current domain semantics while the relational columns support bounded queue queries and database constraints. Provider IDs do not become domain IDs. Realtime, Edge Functions, Storage, and direct database credentials are out of scope.

## Authorization matrix

| Resource/operation | Anonymous | Viewer | Operator | Manager/owner |
| --- | --- | --- | --- | --- |
| Read own workspace | denied | allowed | allowed | allowed |
| Create/update inquiry | denied | denied | allowed | allowed |
| Delete inquiry | denied | denied | denied | allowed |
| Read audit events | denied | allowed | allowed | allowed |
| Append audit event | denied | denied | allowed | allowed |
| Change membership/role | denied | denied | denied | owner only |

The application checks the verified Auth session and membership for UX and role errors. RLS repeats tenant membership and role checks using protected tables. Policies use `USING` for visible/targetable rows and `WITH CHECK` for writes. The only `SECURITY DEFINER` functions are private, fixed-search-path RLS adapter helpers needed to avoid recursive membership policies; their execute privileges are restricted to `authenticated`.

## Workflow state machine

```text
new -> extracting -> needs_info | ready_for_review
needs_info/ready_for_review -> drafting -> approved | rejected
approved -> sending -> sent | delivery_failed
delivery_failed -> sending
sent/approved/rejected/delivery_failed -> closed -> drafting
```

Every transition is server-guarded and appends an immutable event. A delivery attempt is keyed by lead, draft version, and an optional caller idempotency key; a previously sent key returns without sending twice.

## Operational checks and rollback

CI runs typecheck, lint, unit tests, build, migration contract validation, and a local Supabase/pgTAP RLS suite. The RLS fixtures cover anonymous denial, cross-workspace reads/writes, forged workspace IDs, invalid role changes, viewer denial, and allowed owner/operator cases. If Docker/Supabase CLI is unavailable locally, `npm run db:validate` still checks the migration contract and `npm run db:test` reports the exact skipped database test.

The migration is additive on a clean project and has no destructive data backfill. Apply it before switching persisted application traffic; seed only local/non-production. For rollback, deploy the previous app against the additive tables; use a forward migration for policy/schema corrections rather than dropping tenant data. Retention deletes inquiries and cascaded events only through the owner endpoint.

## Portability and provider-side work

Business services consume `InquiryStore` and domain objects, not PostgREST response shapes. Supabase-specific Auth/session and RLS identity code is isolated under `lib/supabase` and `lib/auth.ts`. An exit requires ordinary PostgreSQL schema/data export, replacing the Auth identity provider and session adapter, then validating row counts, foreign keys, audit history, and authorization. Production Auth email confirmation, redirect allowlists, SMTP, CAPTCHA/rate limits, MFA, separate projects/credentials, network restrictions, and advisor review remain unverified operator actions.
