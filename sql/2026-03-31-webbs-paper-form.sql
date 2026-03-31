alter table public.jobs
  add column if not exists webbs_paper_form_completed boolean not null default false;
