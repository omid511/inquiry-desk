# Inquiry Desk

[![CI](https://github.com/omid511/inquiry-desk/actions/workflows/ci.yml/badge.svg)](https://github.com/omid511/inquiry-desk/actions/workflows/ci.yml)
[![CodeQL](https://github.com/omid511/inquiry-desk/actions/workflows/codeql.yml/badge.svg)](https://github.com/omid511/inquiry-desk/actions/workflows/codeql.yml)
[![Issues](https://img.shields.io/github/issues/omid511/inquiry-desk)](https://github.com/omid511/inquiry-desk/issues)
[![License](https://img.shields.io/badge/license-private--portfolio-lightgrey)](LICENSE)

Inquiry Desk is a review-first inquiry operations workspace for independent service teams. A public question becomes a threaded, structured work item; operators see missing fields and confidence, edit a response, approve it, explicitly send/retry it, and close or reopen the inquiry. The product does not auto-send or pretend a demo provider is live.

## Local development

Requires Node 22 (`.nvmrc`). Demo mode must be explicit:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. With `DEMO_MODE=true`, the deterministic extractor, demo workspace, server-side in-memory session store, and mock delivery provider work without secrets. The owner access code is `demo`. Demo data is process-local and is intentionally not production persistence.

Production checks and run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## End-to-end workflow

1. Visitor submits name, contact, consent, and a free-form request. Input is validated, a honeypot and IP window guard run, and idempotency/fingerprint replay is deduplicated.
2. The configured workspace schema determines required fields. A provider interface runs deterministic extraction by default or strict JSON model extraction with an 8-second timeout and fallback.
3. The operator workspace filters/searches the queue, sees SLA aging, confidence, missing fields, extraction runs, thread messages, and audit history, then assigns an operator.
4. The operator edits, approves, or rejects a draft. Approval is a persisted state transition; it does not send.
5. `Send / record delivery` uses the delivery adapter. Demo mode records a mock delivery; `OUTBOUND_EMAIL_PROVIDER=webhook` calls a configured signed-secret webhook with an idempotency key. Failed attempts are visible and retryable.
6. The operator closes or reopens work. Analytics and CSV export are available in the workspace; immutable event history stays attached to the inquiry.

Inbound email/webhook threading is exposed at `POST /api/webhooks/inquiry`. It requires `INBOUND_WEBHOOK_SECRET`, `INBOUND_WEBHOOK_WORKSPACE_ID`, and a valid `x-inquiry-signature` HMAC-SHA256 header. External delivery is only considered verified when the webhook provider is configured and returns success; demo delivery is explicitly labeled in the UI.

## Persistence, auth, and privacy

Set `DEMO_MODE=false`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_ACCESS_TOKEN`, `OWNER_USER_ID`, and `OWNER_WORKSPACE_ID` for a non-demo deployment. Seed a matching membership. The repository boundary in `lib/store.ts` then uses Supabase and persists workspaces, memberships, opaque server-side sessions, inquiries, messages, schema/extracted data, extraction runs, drafts, delivery attempts, idempotency keys, and audit events. The owner API derives workspace and role from the server-side session; request bodies cannot select a workspace or actor.

Apply the schema and seed data with the Supabase SQL editor, Supabase CLI, or your migration runner:

```bash
supabase db push                         # applies supabase/schema.sql when configured
psql "$DATABASE_URL" -f supabase/seed.sql
psql "$DATABASE_URL" -f supabase/reset.sql # destructive demo reset only
```

`RETENTION_DAYS` defaults to 365 and the owner-only retention endpoint deletes old inquiries with cascading related records. Before production, add workspace-scoped RLS policies, a real identity provider mapping, a shared rate limiter, deletion/export request handling, and a reviewed privacy notice.

## CI/CD and Vercel

`.github/workflows/ci.yml` installs Node from `.nvmrc`, installs the manifest, then runs typecheck, lint, tests, and the production build on pushes and pull requests. `vercel.json` declares a Next.js build and install command. Import this directory into Vercel and configure the variables in `.env.example`; no deployment URL is claimed without a verified deployment.

Model configuration: leave `EXTRACTION_PROVIDER=mock` for a credential-free demo, or set `EXTRACTION_PROVIDER=openai`, `OPENAI_API_KEY`, and optional `OPENAI_MODEL`. Delivery configuration: leave the mock provider in demo mode, or set `OUTBOUND_EMAIL_PROVIDER=webhook`, `OUTBOUND_EMAIL_WEBHOOK_URL`, and `OUTBOUND_EMAIL_WEBHOOK_SECRET` after verifying the receiving service.

## Scope boundary

This product has one web intake channel plus signed inbound/outbound integration boundaries. It does not include autonomous phone/SMS/email agents, calendar booking, CRM synchronization, vector search, billing, or unreviewed outbound communication.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local quality bar and pull-request checklist. Report vulnerabilities privately using the process in [SECURITY.md](SECURITY.md); do not open a public issue with secrets or customer data. The public issue forms are for reproducible bugs and bounded product proposals only.

The system handles contact details and inquiry text. Keep secrets in platform environment variables, redact request content from logs, use the retention control before production, and never paste real customer data into fixtures or issues. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the trust boundaries and state model.
