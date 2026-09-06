begin;
select plan(13);

insert into public.app_users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'rls-a@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'rls-b@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'rls-viewer@example.com');
insert into public.auth_identities (app_user_id, provider, subject, email) values
  ('00000000-0000-0000-0000-000000000001', 'supabase', '10000000-0000-0000-0000-000000000001', 'rls-a@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'supabase', '10000000-0000-0000-0000-000000000002', 'rls-b@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'supabase', '10000000-0000-0000-0000-000000000003', 'rls-viewer@example.com');
insert into public.workspaces (id, name, schema) values
  ('rls-workspace-a', 'RLS A', '{}'::jsonb),
  ('rls-workspace-b', 'RLS B', '{}'::jsonb);
insert into public.workspace_memberships (app_user_id, workspace_id, role) values
  ('00000000-0000-0000-0000-000000000001', 'rls-workspace-a', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'rls-workspace-b', 'operator'),
  ('00000000-0000-0000-0000-000000000003', 'rls-workspace-a', 'viewer');
insert into public.inquiries (id, workspace_id, status, idempotency_key, fingerprint, created_at, updated_at, payload)
values ('rls-inquiry-a', 'rls-workspace-a', 'new', 'rls-key-a', 'rls-fingerprint-a', now(), now(), '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::int from public.inquiries), 1, 'owner can read own workspace');
select is((select count(*)::int from public.inquiries where workspace_id = 'rls-workspace-b'), 0, 'cross-workspace rows are hidden');
select lives_ok($$insert into public.inquiries (id, workspace_id, status, idempotency_key, fingerprint, created_at, updated_at, payload) values ('rls-inquiry-a2', 'rls-workspace-a', 'new', 'rls-key-a2', 'rls-fingerprint-a2', now(), now(), '{}'::jsonb)$$, 'owner can insert own workspace');
select throws_ok($$insert into public.inquiries (id, workspace_id, status, idempotency_key, fingerprint, created_at, updated_at, payload) values ('rls-inquiry-b-forged', 'rls-workspace-b', 'new', 'rls-key-b-forged', 'rls-fingerprint-b-forged', now(), now(), '{}'::jsonb)$$, '42501', null, 'forged workspace insert is denied');
select throws_ok($$update public.workspace_memberships set role = 'owner' where workspace_id = 'rls-workspace-a' and app_user_id = '00000000-0000-0000-0000-000000000003'$$, '42501', null, 'membership role forgery is denied');
select throws_ok($$insert into public.workspace_memberships (app_user_id, workspace_id, role) values ('00000000-0000-0000-0000-000000000003', 'rls-workspace-a', 'invalid')$$, '23514', null, 'invalid role is rejected by constraint');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is((select count(*)::int from public.inquiries), 2, 'viewer can read own workspace');
select throws_ok($$insert into public.inquiries (id, workspace_id, status, idempotency_key, fingerprint, created_at, updated_at, payload) values ('rls-inquiry-viewer', 'rls-workspace-a', 'new', 'rls-key-viewer', 'rls-fingerprint-viewer', now(), now(), '{}'::jsonb)$$, '42501', null, 'viewer cannot insert');
select throws_ok($$update public.inquiries set status = 'closed' where id = 'rls-inquiry-a'$$, '42501', null, 'viewer cannot update');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::int from public.inquiries), 0, 'wrong workspace is denied');
select lives_ok($$insert into public.inquiries (id, workspace_id, status, idempotency_key, fingerprint, created_at, updated_at, payload) values ('rls-inquiry-b', 'rls-workspace-b', 'new', 'rls-key-b', 'rls-fingerprint-b', now(), now(), '{}'::jsonb)$$, 'operator can insert own workspace');

set local role anon;
select throws_ok($$select 1 from public.inquiries$$, '42501', null, 'anonymous cannot read inquiries');
select throws_ok($$insert into public.inquiries (id, workspace_id, status, idempotency_key, fingerprint, created_at, updated_at, payload) values ('rls-inquiry-anon', 'rls-workspace-a', 'new', 'rls-key-anon', 'rls-fingerprint-anon', now(), now(), '{}'::jsonb)$$, '42501', null, 'anonymous cannot insert');
select * from finish();
rollback;
