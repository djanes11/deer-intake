create extension if not exists pgcrypto;

create table if not exists public.processor_users (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.processors(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processor_users_role_check check (role in ('admin', 'staff', 'readonly'))
);

create unique index if not exists processor_users_processor_email_uidx
  on public.processor_users (processor_id, lower(email));

create unique index if not exists processor_users_processor_user_uidx
  on public.processor_users (processor_id, user_id)
  where user_id is not null;

create index if not exists processor_users_email_idx
  on public.processor_users (lower(email));

create index if not exists processor_users_user_id_idx
  on public.processor_users (user_id);

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_admins_email_uidx
  on public.platform_admins (lower(email));

create unique index if not exists platform_admins_user_id_uidx
  on public.platform_admins (user_id)
  where user_id is not null;
