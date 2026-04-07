alter table public.processors
  add column if not exists billing_status text not null default 'setup',
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists monthly_price numeric null,
  add column if not exists trial_ends_at timestamptz null,
  add column if not exists subscription_started_at timestamptz null,
  add column if not exists go_live_at timestamptz null,
  add column if not exists billing_notes text null;

update public.processors
set billing_status = coalesce(nullif(billing_status, ''), 'internal')
where slug = 'mcafee';
