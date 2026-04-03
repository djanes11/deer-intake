create extension if not exists pgcrypto;

create table if not exists public.processors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  public_name text null,
  active boolean not null default true,
  branding jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.processors (slug, name, public_name)
values ('mcafee', 'McAfee Custom Deer Processing', 'McAfee Deer Processing')
on conflict (slug) do update
set
  name = excluded.name,
  public_name = excluded.public_name,
  updated_at = now();

alter table public.jobs
  add column if not exists processor_id uuid null references public.processors(id) on delete restrict;

alter table public.site_settings
  add column if not exists processor_id uuid null references public.processors(id) on delete cascade;

alter table public.sms_logs
  add column if not exists processor_id uuid null references public.processors(id) on delete cascade;

with mcafee as (
  select id
  from public.processors
  where slug = 'mcafee'
  limit 1
)
update public.jobs
set processor_id = mcafee.id
from mcafee
where public.jobs.processor_id is null;

with mcafee as (
  select id
  from public.processors
  where slug = 'mcafee'
  limit 1
)
update public.site_settings
set processor_id = mcafee.id
from mcafee
where public.site_settings.processor_id is null;

with mcafee as (
  select id
  from public.processors
  where slug = 'mcafee'
  limit 1
)
update public.sms_logs
set processor_id = mcafee.id
from mcafee
where public.sms_logs.processor_id is null;

alter table public.jobs
  alter column processor_id set not null;

alter table public.site_settings
  alter column processor_id set not null;

alter table public.sms_logs
  alter column processor_id set not null;

create unique index if not exists jobs_processor_tag_unique_idx
  on public.jobs (processor_id, tag);

create index if not exists jobs_processor_confirmation_idx
  on public.jobs (processor_id, confirmation);

create index if not exists jobs_processor_dropoff_idx
  on public.jobs (processor_id, dropoff_date desc);

create index if not exists sms_logs_processor_created_idx
  on public.sms_logs (processor_id, created_at desc);

create unique index if not exists site_settings_processor_unique_idx
  on public.site_settings (processor_id);
