-- First production-shaped persistence boundary. Keep this file as the deployable source of truth;
-- supabase/schema.sql is a clean-install reference copy for operators using psql.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  provider text not null check (provider <> ''),
  subject text not null check (subject <> ''),
  email text,
  created_at timestamptz not null default now(),
  unique (provider, subject)
);
create index if not exists auth_identities_app_user_idx on public.auth_identities (app_user_id);
create table if not exists public.workspaces (
  id text primary key,
  name text not null check (length(name) between 1 and 160),
  schema jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.workspace_memberships (
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, app_user_id)
);
create index if not exists workspace_memberships_app_user_idx on public.workspace_memberships (app_user_id, workspace_id);
create index if not exists workspace_memberships_workspace_role_idx on public.workspace_memberships (workspace_id, role, app_user_id);
create table if not exists public.inquiries (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  creator_app_user_id uuid references public.app_users(id) on delete set null,
  assigned_to text,
  status text not null check (status in ('new', 'extracting', 'needs_info', 'ready_for_review', 'drafting', 'approved', 'rejected', 'sending', 'sent', 'delivery_failed', 'closed')),
  priority text check (priority in ('low', 'normal', 'high')),
  idempotency_key text not null,
  fingerprint text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  payload jsonb not null,
  unique (workspace_id, idempotency_key),
  unique (workspace_id, id)
);
create index if not exists inquiries_workspace_created_idx on public.inquiries (workspace_id, created_at desc, id desc);
create index if not exists inquiries_workspace_status_created_idx on public.inquiries (workspace_id, status, created_at desc, id desc);
create index if not exists inquiries_workspace_assignment_idx on public.inquiries (workspace_id, assigned_to, updated_at desc);
create index if not exists inquiries_workspace_fingerprint_created_idx on public.inquiries (workspace_id, fingerprint, created_at desc);
create table if not exists public.inquiry_events (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  inquiry_id text not null,
  action text not null check (length(action) between 1 and 120),
  actor text not null check (length(actor) between 1 and 160),
  detail text check (detail is null or length(detail) <= 240),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.inquiry_events add constraint inquiry_events_workspace_inquiry_fk
  foreign key (workspace_id, inquiry_id) references public.inquiries(workspace_id, id) on delete cascade;
create index if not exists inquiry_events_workspace_created_idx on public.inquiry_events (workspace_id, created_at desc, id desc);
create index if not exists inquiry_events_inquiry_created_idx on public.inquiry_events (inquiry_id, created_at asc, id asc);

create or replace function private.current_app_user_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select ai.app_user_id from public.auth_identities ai where ai.provider = 'supabase' and ai.subject = (select auth.uid()::text) limit 1 $$;
create or replace function private.is_workspace_member(target_workspace_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.workspace_memberships wm where wm.workspace_id = target_workspace_id and wm.app_user_id = private.current_app_user_id()) $$;
create or replace function private.has_workspace_role(target_workspace_id text, allowed_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.workspace_memberships wm where wm.workspace_id = target_workspace_id and wm.app_user_id = private.current_app_user_id() and wm.role = any (allowed_roles)) $$;
create or replace function private.prevent_inquiry_workspace_change()
returns trigger language plpgsql set search_path = ''
as $$ begin if old.workspace_id is distinct from new.workspace_id then raise exception 'inquiry workspace is immutable'; end if; return new; end $$;
drop trigger if exists inquiry_workspace_immutable on public.inquiries;
create trigger inquiry_workspace_immutable before update on public.inquiries for each row execute function private.prevent_inquiry_workspace_change();
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.current_app_user_id() from public;
revoke all on function private.is_workspace_member(text) from public;
revoke all on function private.has_workspace_role(text, text[]) from public;
grant execute on function private.current_app_user_id() to authenticated;
grant execute on function private.is_workspace_member(text) to authenticated;
grant execute on function private.has_workspace_role(text, text[]) to authenticated;

alter table public.app_users enable row level security;
alter table public.auth_identities enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_events enable row level security;

drop policy if exists app_users_select_self on public.app_users;
create policy app_users_select_self on public.app_users for select to authenticated using (id = private.current_app_user_id());
drop policy if exists app_users_insert_denied on public.app_users;
create policy app_users_insert_denied on public.app_users for insert to authenticated with check (false);
drop policy if exists app_users_update_denied on public.app_users;
create policy app_users_update_denied on public.app_users for update to authenticated using (false) with check (false);
drop policy if exists app_users_delete_denied on public.app_users;
create policy app_users_delete_denied on public.app_users for delete to authenticated using (false);
drop policy if exists auth_identities_select_self on public.auth_identities;
create policy auth_identities_select_self on public.auth_identities for select to authenticated using (app_user_id = private.current_app_user_id());
drop policy if exists auth_identities_insert_denied on public.auth_identities;
create policy auth_identities_insert_denied on public.auth_identities for insert to authenticated with check (false);
drop policy if exists auth_identities_update_denied on public.auth_identities;
create policy auth_identities_update_denied on public.auth_identities for update to authenticated using (false) with check (false);
drop policy if exists auth_identities_delete_denied on public.auth_identities;
create policy auth_identities_delete_denied on public.auth_identities for delete to authenticated using (false);
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces for select to authenticated using (private.is_workspace_member(id));
drop policy if exists workspaces_insert_denied on public.workspaces;
create policy workspaces_insert_denied on public.workspaces for insert to authenticated with check (false);
drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner on public.workspaces for update to authenticated using (private.has_workspace_role(id, array['owner'])) with check (private.has_workspace_role(id, array['owner']));
drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner on public.workspaces for delete to authenticated using (private.has_workspace_role(id, array['owner']));
drop policy if exists workspace_memberships_select_member on public.workspace_memberships;
create policy workspace_memberships_select_member on public.workspace_memberships for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists workspace_memberships_insert_owner on public.workspace_memberships;
create policy workspace_memberships_insert_owner on public.workspace_memberships for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner']));
drop policy if exists workspace_memberships_update_owner on public.workspace_memberships;
create policy workspace_memberships_update_owner on public.workspace_memberships for update to authenticated using (private.has_workspace_role(workspace_id, array['owner'])) with check (private.has_workspace_role(workspace_id, array['owner']));
drop policy if exists workspace_memberships_delete_owner on public.workspace_memberships;
create policy workspace_memberships_delete_owner on public.workspace_memberships for delete to authenticated using (private.has_workspace_role(workspace_id, array['owner']));
drop policy if exists inquiries_select_member on public.inquiries;
create policy inquiries_select_member on public.inquiries for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists inquiries_insert_operator on public.inquiries;
create policy inquiries_insert_operator on public.inquiries for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner', 'manager', 'operator']));
drop policy if exists inquiries_update_operator on public.inquiries;
create policy inquiries_update_operator on public.inquiries for update to authenticated using (private.has_workspace_role(workspace_id, array['owner', 'manager', 'operator'])) with check (private.has_workspace_role(workspace_id, array['owner', 'manager', 'operator']));
drop policy if exists inquiries_delete_manager on public.inquiries;
create policy inquiries_delete_manager on public.inquiries for delete to authenticated using (private.has_workspace_role(workspace_id, array['owner', 'manager']));
drop policy if exists inquiry_events_select_member on public.inquiry_events;
create policy inquiry_events_select_member on public.inquiry_events for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists inquiry_events_insert_operator on public.inquiry_events;
create policy inquiry_events_insert_operator on public.inquiry_events for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner', 'manager', 'operator']));
drop policy if exists inquiry_events_update_denied on public.inquiry_events;
create policy inquiry_events_update_denied on public.inquiry_events for update to authenticated using (false) with check (false);
drop policy if exists inquiry_events_delete_denied on public.inquiry_events;
create policy inquiry_events_delete_denied on public.inquiry_events for delete to authenticated using (false);

revoke all on table public.app_users, public.auth_identities, public.workspaces, public.workspace_memberships, public.inquiries, public.inquiry_events from anon;
grant select on table public.app_users, public.auth_identities, public.workspaces, public.workspace_memberships, public.inquiries, public.inquiry_events to authenticated;
grant insert, update, delete on table public.workspaces, public.workspace_memberships, public.inquiries, public.inquiry_events to authenticated;
