alter table public.site_settings
  add column if not exists stateform_page_number integer not null default 1,
  add column if not exists stateform_printed_job_ids jsonb not null default '[]'::jsonb;
