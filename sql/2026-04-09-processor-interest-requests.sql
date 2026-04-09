create extension if not exists pgcrypto;

create table if not exists public.processor_interest_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text null,
  state text null,
  annual_volume text null,
  current_workflow text null,
  notes text null,
  source_host text null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processor_interest_requests_status_check check (status in ('new', 'contacted', 'qualified', 'closed'))
);

create index if not exists processor_interest_requests_created_idx
  on public.processor_interest_requests (created_at desc);
