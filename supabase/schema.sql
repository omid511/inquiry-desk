-- Apply with Supabase SQL editor or `supabase db push`.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id text primary key,
  name text not null,
  schema jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.memberships (
  user_id text not null,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('owner','manager','operator','viewer')),
  email text not null,
  primary key (user_id, workspace_id)
);
create table if not exists public.sessions (
  token text primary key,
  user_id text not null,
  workspace_id text not null,
  role text not null,
  expires_at timestamptz not null
);
create index if not exists sessions_expiry_idx on public.sessions (expires_at);

create table if not exists public.inquiry_leads (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  payload jsonb not null
);
create index if not exists inquiry_leads_workspace_created_idx on public.inquiry_leads (workspace_id, created_at desc);
create table if not exists public.inquiry_messages (
  id text primary key,
  lead_id text not null references public.inquiry_leads(id) on delete cascade,
  direction text not null,
  body text not null,
  channel text not null,
  created_at timestamptz not null,
  created_by text not null
);
create table if not exists public.extraction_runs (
  id text primary key,
  lead_id text not null references public.inquiry_leads(id) on delete cascade,
  provider text not null,
  status text not null,
  confidence numeric not null,
  created_at timestamptz not null,
  error text
);
create table if not exists public.inquiry_drafts (
  id text primary key,
  lead_id text not null references public.inquiry_leads(id) on delete cascade,
  version integer not null,
  body text not null,
  status text not null,
  created_at timestamptz not null,
  created_by text not null
);
create table if not exists public.delivery_attempts (
  id text primary key,
  lead_id text not null references public.inquiry_leads(id) on delete cascade,
  idempotency_key text not null unique,
  channel text not null,
  recipient text not null,
  status text not null,
  attempts integer not null,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table if not exists public.idempotency_keys (
  key text primary key,
  lead_id text not null references public.inquiry_leads(id) on delete cascade,
  workspace_id text not null
);
create table if not exists public.audit_events (
  id text primary key,
  lead_id text not null references public.inquiry_leads(id) on delete cascade,
  type text not null,
  actor text not null,
  detail text,
  created_at timestamptz not null
);

-- The server adapter uses SUPABASE_SERVICE_ROLE_KEY. Keep all tables inaccessible to
-- browser clients until workspace-scoped RLS policies are added for the chosen auth model.
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.sessions enable row level security;
alter table public.inquiry_leads enable row level security;
alter table public.inquiry_messages enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.inquiry_drafts enable row level security;
alter table public.delivery_attempts enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.audit_events enable row level security;
