insert into public.workspaces (id, name, schema)
values ('demo-workspace', 'Demo service desk', '{"id":"default-service-inquiry","name":"Service inquiry","requiredFields":["requestedService","timeWindow","location"],"slaHours":48}'::jsonb)
on conflict (id) do nothing;
insert into public.memberships (user_id, workspace_id, role, email)
values ('demo-owner', 'demo-workspace', 'owner', 'owner@example.com')
on conflict (user_id, workspace_id) do nothing;
