create extension if not exists pgcrypto;

create table if not exists public.square_payment_links (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  processor_id uuid null references public.processors(id) on delete cascade,
  tag text null,
  confirmation text null,
  customer_name text null,
  amount_cents integer not null,
  processing_amount_cents integer null,
  online_fee_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending',
  square_environment text not null default 'sandbox',
  square_payment_link_id text null,
  square_order_id text null,
  square_payment_id text null,
  square_checkout_url text null,
  square_long_url text null,
  idempotency_key text not null,
  last_event_type text null,
  last_event_at timestamptz null,
  completed_at timestamptz null,
  raw_create_response jsonb null,
  raw_last_event jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists square_payment_links_order_uidx
  on public.square_payment_links (square_order_id)
  where square_order_id is not null and square_order_id <> '';

create index if not exists square_payment_links_job_status_idx
  on public.square_payment_links (job_id, status, created_at desc);

create index if not exists square_payment_links_processor_created_idx
  on public.square_payment_links (processor_id, created_at desc);

create unique index if not exists square_payment_links_active_job_uidx
  on public.square_payment_links (job_id)
  where status in ('pending', 'created', 'open');
