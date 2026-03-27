alter table public.jobs
  add column if not exists intake_sheet_printed_at timestamptz null,
  add column if not exists intake_sheet_print_count integer not null default 0;
