alter table public.jobs
  add column if not exists cape_finished_email_sent_at timestamptz,
  add column if not exists specialty_finished_email_sent_at timestamptz,
  add column if not exists webbs_delivered_email_sent_at timestamptz;
