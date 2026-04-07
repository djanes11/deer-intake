alter table public.jobs
  add column if not exists processing_started_at timestamptz null,
  add column if not exists processing_finished_at timestamptz null;
