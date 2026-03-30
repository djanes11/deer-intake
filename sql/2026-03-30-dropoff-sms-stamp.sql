alter table public.jobs
  add column if not exists dropoff_sms_sent_at timestamptz null;
