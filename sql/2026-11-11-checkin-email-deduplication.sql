-- Run before deploying the check-in email guard. Safe to run again.
-- SMTP cannot atomically commit with our database. Keep even uncertain attempts
-- reserved: staff can deliberately resend after checking delivery, but another
-- intake save must never automatically repeat an email that may have arrived.
begin;
create table if not exists public.job_checkin_email_delivery (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  processor_id uuid references public.processors(id) on delete cascade,
  state text not null check (state in ('sending', 'sent', 'uncertain')),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.job_checkin_email_delivery enable row level security;
revoke all on public.job_checkin_email_delivery from public, anon, authenticated;
grant select, insert, update on public.job_checkin_email_delivery to service_role;

-- Preserve the already-sent history even if an old intake client later submits
-- a stale or empty notification timestamp. Never change the deer records here.
insert into public.job_checkin_email_delivery (job_id, processor_id, state, attempted_at, sent_at)
select id, processor_id, 'sent', dropoff_email_sent_at, dropoff_email_sent_at
from public.jobs where dropoff_email_sent_at is not null
on conflict (job_id) do nothing;
commit;
