create extension if not exists pgcrypto;

create table if not exists public.processor_audit_log (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.processors(id) on delete cascade,
  actor_auth_type text not null default 'none',
  actor_user_id text null,
  actor_email text null,
  actor_username text null,
  actor_role text null,
  action text not null,
  target_type text not null,
  target_id text null,
  target_label text null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists processor_audit_log_processor_created_idx
  on public.processor_audit_log (processor_id, created_at desc);

create index if not exists processor_audit_log_action_idx
  on public.processor_audit_log (action, created_at desc);
