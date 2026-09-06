-- Local/non-production seed only. It creates a workspace, not a Supabase Auth user.
-- The first real sign-in provisions app_users/auth_identities idempotently.
insert into public.workspaces (id, name, schema)
values ('demo-workspace', 'Demo service desk', '{"id":"default-service-inquiry","name":"Service inquiry","requiredFields":["requestedService","timeWindow","location"],"slaHours":48}'::jsonb)
on conflict (id) do nothing;
