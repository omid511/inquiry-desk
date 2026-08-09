# Contributing

## Before opening a pull request

1. Keep the product boundary review-first: no autonomous outbound communication or unrelated channel surface.
2. Add or update a domain test for workflow, validation, authorization, persistence, or delivery behavior you change.
3. Run `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
4. Never commit `.env.local`, service-role keys, real inquiry text, or customer contact data.
5. Describe migration, environment, retention, and rollback impact in the pull request.

## Pull requests

Use a focused branch and explain the user-facing behavior, test evidence, and unresolved risks. Keep changes small enough to review. Changes to workflow transitions, authorization, delivery, migrations, or PII handling need explicit tests and reviewer attention.

## Local demo

Copy `.env.example` to `.env.local` with `DEMO_MODE=true`. Demo persistence and delivery are process-local and must not be presented as production behavior.
