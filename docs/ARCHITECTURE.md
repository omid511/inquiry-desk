# Inquiry Desk architecture

## Product boundary

Inquiry Desk is a single web intake channel for small service teams. A visitor submits an inquiry; operators classify, review, draft, approve, explicitly deliver, and close it. The system has no autonomous outbound agent, calendar side effect, CRM sync, or multi-channel identity graph.

## Runtime shape

```text
visitor -> /api/intake -> validation/rate/idempotency -> extractor provider
                                      |                  -> structured fields + run
                                      v
                             repository adapter
                                      |
operator session -> owner APIs -> queue/detail -> approve/reject -> send/retry -> close/reopen
                                      |                 |             |
                                      +-> messages      +-> delivery  +-> audit events
```

The Next.js App Router owns UI and request boundaries. `lib/domain.ts` defines the domain vocabulary and Zod contracts. `lib/workflow.ts` is the single transition guard. `lib/extraction.ts` exposes an injectable provider interface with a deterministic fallback. `lib/delivery.ts` exposes mock and webhook delivery providers; mock delivery is explicit and never described as external delivery.

## Trust and authorization boundaries

- Public intake may create only a new inquiry in the configured public workspace. It cannot read or mutate owner records.
- Login validates the configured access token, creates an opaque server-side session, and writes only the session token to an HTTP-only cookie.
- Owner APIs load the session from the repository, re-check its workspace membership, and derive workspace/user/role from that record. Request bodies cannot choose an actor or tenant.
- Supabase uses a service-role server adapter. Browser clients do not receive the service-role key. RLS is enabled in the migration; workspace-scoped policies must be reviewed before direct client access.
- Inbound webhooks require a configured workspace, HMAC-SHA256 signature, and email/lead match. Outbound webhooks carry a secret and delivery idempotency key.
- Logs use bounded error messages and do not intentionally include inquiry bodies, prompts, model output, or secrets. Retention deletes a lead and cascading child records after the configured age.

## Persistence model

`InquiryStore` is the application seam. `InMemoryInquiryStore` exists only when `DEMO_MODE=true`. With Supabase URL and service-role key configured, `SupabaseInquiryStore` stores the lead payload plus normalized child records:

- `workspaces`, `memberships`, `sessions`
- `inquiry_leads`, `inquiry_messages`
- `extraction_runs`, `inquiry_drafts`
- `delivery_attempts`, `idempotency_keys`, `audit_events`

`supabase/schema.sql` creates the tables and indexes; `seed.sql` creates the demo workspace membership; `reset.sql` is a destructive demo reset. Production identity provisioning should replace the single configured owner token with a real identity provider and membership management.

## Workflow state machine

```text
new -> extracting -> needs_info | ready_for_review
needs_info/ready_for_review -> drafting -> approved | rejected
approved -> sending -> sent | delivery_failed
delivery_failed -> sending
sent/approved/rejected/delivery_failed -> closed -> drafting
```

Every transition is server-guarded and appends an immutable audit event. A delivery attempt is keyed by lead, draft version, and an optional caller idempotency key; a previously sent key returns without sending twice. A provider exception is converted into `delivery_failed` with an error and retryable attempt count.

## Operational checks

The public CI workflow runs install, typecheck, lint, tests, and build. CodeQL scans JavaScript/TypeScript, and dependency review checks pull-request changes. Dependabot watches npm and GitHub Actions. The manual workflow reruns CI on demand. Tag releases run typecheck/tests and publish a source tarball as both an artifact and GitHub release asset. Workflow actions use maintained major tags (`@v4`/`@v3`) so security fixes receive upstream updates without pinning to abandoned action lines; review or pin immutable SHAs when the repository adopts a stricter supply-chain policy. Each workflow grants only the permissions it needs. See `README.md`, `CONTRIBUTING.md`, and `SECURITY.md` for operator and contributor procedures.
