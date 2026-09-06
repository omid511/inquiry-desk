# Contributing

## Before opening a pull request

1. Keep the product boundary review-first: no autonomous outbound communication or unrelated channel surface.
2. Add or update a domain test for workflow, validation, authorization, persistence, or delivery behavior you change.
3. Run `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run db:validate`, `npm run db:test`, and `npm run build`.
4. Never commit `.env.local`, service-role keys, real inquiry text, or customer contact data.
5. Describe migration, environment, retention, and rollback impact in the pull request.
6. For schema or RLS changes, include the policy matrix, affected indexes, denied/allowed test evidence, and whether a clean local migration was applied.

## Pull requests

Use a focused branch and explain the user-facing behavior, test evidence, and unresolved risks. Keep changes small enough to review. Changes to workflow transitions, authorization, delivery, migrations, or PII handling need explicit tests and reviewer attention.

## Local demo

Copy `.env.example` to `.env.local` with `DEMO_MODE=true`. Demo persistence and delivery are process-local and must not be presented as production behavior.

## Persisted local mode

Run `supabase start`, apply the migrations with `supabase db reset`, and set `DEMO_MODE=false` with the local URL/publishable key and a server-only service-role key. Persisted Auth users are linked to `app_users` on sign-in; new users receive the configured default workspace role, which is `viewer` unless deliberately changed. Do not use production credentials in local development or seed real customer data.
