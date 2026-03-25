alter table public.jobs
  add column if not exists webbs_items jsonb not null default '[]'::jsonb;
