alter table public.processors
  add column if not exists setup_completed_at timestamptz null;
