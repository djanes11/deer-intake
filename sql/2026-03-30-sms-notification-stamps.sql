alter table public.jobs
  add column if not exists meat_finished_sms_sent_at timestamptz,
  add column if not exists cape_finished_sms_sent_at timestamptz,
  add column if not exists specialty_finished_sms_sent_at timestamptz,
  add column if not exists webbs_delivered_sms_sent_at timestamptz;
