create extension if not exists pgcrypto;

create table if not exists public.staff_local_users (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.processors(id) on delete cascade,
  username text not null,
  password_hash text not null,
  role text not null default 'staff',
  active boolean not null default true,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_local_users_role_check check (role in ('staff', 'readonly'))
);

create unique index if not exists staff_local_users_processor_username_uidx
  on public.staff_local_users (processor_id, lower(username));

create index if not exists staff_local_users_processor_idx
  on public.staff_local_users (processor_id);

create table if not exists public.staff_local_sessions (
  id uuid primary key default gen_random_uuid(),
  local_user_id uuid not null references public.staff_local_users(id) on delete cascade,
  session_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_local_sessions_token_uidx
  on public.staff_local_sessions (session_token);

create index if not exists staff_local_sessions_user_idx
  on public.staff_local_sessions (local_user_id);
