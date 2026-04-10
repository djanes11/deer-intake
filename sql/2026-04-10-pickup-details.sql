alter table public.jobs
  add column if not exists picked_up_by text null,
  add column if not exists pickup_notes text null;
 